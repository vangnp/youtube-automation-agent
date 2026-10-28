// Word-level timing from real speech. whisper.cpp (local, free) transcribes the narration; its words
// are matched against the words we know were spoken (the script), so the captions always show the
// script's exact text while taking their timing from the audio.
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { getFFmpegPath } = require('./ffmpeg');
const { spellOutVietnameseNumbers } = require('./vi-numbers');

const execFileAsync = promisify(execFile);
const REMOTION_DIR = path.join(__dirname, '..', 'remotion');
const WHISPER_DIR = path.join(REMOTION_DIR, '.whisper');
const MIN_MATCHED_SHARE = 0.4;

function whisperModel() {
  return process.env.WHISPER_MODEL || 'small';
}

// Opt-out with WHISPER=off. Needs `npm run whisper:install` once.
function isWhisperReady() {
  if (String(process.env.WHISPER || '').toLowerCase() === 'off') return false;
  return fsSync.existsSync(path.join(WHISPER_DIR, 'whisper.cpp', 'main'))
    && fsSync.existsSync(path.join(WHISPER_DIR, 'models', `ggml-${whisperModel()}.bin`));
}

// Whisper writes numbers as digits ("1998", "4,5") while a Vietnamese script spells them out for the voice
// ("một nghìn chín trăm chín mươi tám"). Spell the heard digits out too, sharing the word's time between the
// words it becomes, so the two sides can be compared.
function spellHeardNumbers(recognised) {
  const out = [];
  for (const word of recognised) {
    const match = /\d/.test(word.text) && String(word.text).match(/^(\D*)(\d[\d.,]*\d|\d)(\D*)$/);
    if (!match) { out.push(word); continue; }
    const spoken = spellOutVietnameseNumbers(match[2]).split(' ').filter(Boolean);
    const step = (word.end - word.start) / spoken.length;
    spoken.forEach((text, i) => out.push({
      text: `${i === 0 ? match[1] : ''}${text}${i === spoken.length - 1 ? match[3] : ''}`,
      start: word.start + step * i, end: word.start + step * (i + 1)
    }));
  }
  return out;
}

// Case, accents and punctuation never decide a match ("Yang" is often heard as "Giang").
function normalize(word) {
  return String(word || '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]/g, '');
}

function editDistanceAtMostOne(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function similarity(a, b) {
  if (!a || !b) return -1;
  if (a === b) return 3;
  if (a.length >= 3 && b.length >= 3 && editDistanceAtMostOne(a, b)) return 1;
  return -2;
}

/**
 * Align the script's words to the recognised words (global alignment, so a misheard or missing word
 * only costs that word). Returns { words: [{start, end}] one per script word, matched, share } or
 * null when too little of the script was recognised to trust the timing.
 */
function alignScriptToSpeech(scriptWords, heard, totalSeconds) {
  // a script that spells its numbers is compared with the heard numbers spelled the same way
  const recognised = scriptWords.some(word => /\d/.test(word)) ? heard : spellHeardNumbers(heard);
  const n = scriptWords.length;
  const m = recognised.length;
  if (!n || !m) return null;
  const a = scriptWords.map(normalize);
  const b = recognised.map(word => normalize(word.text));
  const GAP = -1;

  const score = Array.from({ length: n + 1 }, () => new Float32Array(m + 1));
  const move = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));
  for (let i = 1; i <= n; i++) { score[i][0] = i * GAP; move[i][0] = 1; }
  for (let j = 1; j <= m; j++) { score[0][j] = j * GAP; move[0][j] = 2; }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const diagonal = score[i - 1][j - 1] + similarity(a[i - 1], b[j - 1]);
      const up = score[i - 1][j] + GAP;
      const left = score[i][j - 1] + GAP;
      if (diagonal >= up && diagonal >= left) { score[i][j] = diagonal; move[i][j] = 0; }
      else if (up >= left) { score[i][j] = up; move[i][j] = 1; }
      else { score[i][j] = left; move[i][j] = 2; }
    }
  }

  const anchors = new Array(n).fill(null);
  let matched = 0;
  for (let i = n, j = m; i > 0 || j > 0;) {
    const step = move[i][j];
    if (i > 0 && j > 0 && step === 0) {
      if (similarity(a[i - 1], b[j - 1]) > 0) { anchors[i - 1] = recognised[j - 1]; matched++; }
      i--; j--;
    } else if (i > 0 && (j === 0 || step === 1)) i--;
    else j--;
  }
  const share = matched / n;
  if (share < MIN_MATCHED_SHARE) return null;

  // Words with no match take the time between their neighbours' anchors, split by length.
  const timed = new Array(n);
  let i = 0;
  while (i < n) {
    if (anchors[i]) { timed[i] = { start: anchors[i].start, end: Math.max(anchors[i].end, anchors[i].start + 0.05) }; i++; continue; }
    let k = i;
    while (k < n && !anchors[k]) k++;
    const from = i === 0 ? 0 : timed[i - 1].end;
    const to = k === n ? Math.max(from, totalSeconds) : anchors[k].start;
    const weights = scriptWords.slice(i, k).map(word => Math.max(2, String(word).length));
    const sum = weights.reduce((x, y) => x + y, 0);
    let cursor = from;
    for (let w = i; w < k; w++) {
      const span = ((to - from) * weights[w - i]) / sum;
      timed[w] = { start: cursor, end: cursor + Math.max(0.04, span) };
      cursor += span;
    }
    i = k;
  }
  // Keep time moving forward even when the recogniser's tokens overlap.
  for (let w = 1; w < n; w++) {
    if (timed[w].start < timed[w - 1].start) timed[w].start = timed[w - 1].start;
    if (timed[w].end < timed[w].start + 0.04) timed[w].end = timed[w].start + 0.04;
  }
  return { words: timed, matched, share };
}

/** Transcribe `audioPath` with whisper.cpp. Resolves to [{text, start, end}] in seconds. */
async function transcribeWords(audioPath, { language = null, workDir }) {
  const wav = path.join(workDir, 'whisper-input.wav');
  await execFileAsync(getFFmpegPath(), ['-y', '-v', 'error', '-i', audioPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav]);
  const { stdout } = await execFileAsync(
    process.execPath,
    [path.join(REMOTION_DIR, 'tools', 'transcribe.js'), wav, language || '', whisperModel()],
    { cwd: workDir, maxBuffer: 256 * 1024 * 1024, timeout: Number(process.env.WHISPER_TIMEOUT_MS) || 20 * 60 * 1000 }
  );
  const marker = stdout.lastIndexOf('@@WORDS@@');
  if (marker < 0) throw new Error('whisper returned no words');
  const words = JSON.parse(stdout.slice(marker + '@@WORDS@@'.length));
  await fs.rm(wav, { force: true });
  return words;
}

module.exports = { isWhisperReady, transcribeWords, alignScriptToSpeech, normalize };
