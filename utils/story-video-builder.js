/**
 * Builds one finished vertical video from a storyboard:
 *   storyboard -> narration (TTS) -> whisper word timing -> captions -> canvas-drawn scenes -> MP4 + thumbnail.
 *
 * Only the finished video goes to data/videos/<slug>.mp4. Everything else lives in data/projects/<slug>/:
 *   script/     storyboard.json, narration.txt
 *   narration/  narration.mp3, meta.json
 *   captions/   captions.vi.srt, words.json (word-level timing), whisper-words.json
 *   assets/     thumbnail.png, mascot.svg, scenes/*.png
 *   render/     props.json (exact input of the last render)
 *
 * Used by scripts/make-story-video.js (a storyboard file) and by the production agent (a storyboard
 * written from the AI script), so both produce the same video and folder layout.
 */
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const { AIVideoGenerator } = require('./ai-video-generator');
const { getMediaDuration, runFFmpeg } = require('./ffmpeg');
const { isWhisperReady, transcribeWords } = require('./speech-aligner');
const renderer = require('./remotion-renderer');
const { contentLanguage } = require('./content-language');
const { validateStoryboard } = require('./story-templates');

const ROOT = path.join(__dirname, '..');
const MAX_WORDS_PER_PHRASE = 6;
// A text-to-speech call that is too long gets cut off or throttled, so the narration is spoken in parts.
const MAX_WORDS_PER_TTS_CALL = 220;
const TTS_ATTEMPTS = 4;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const wordCount = text => text.split(/\s+/).filter(Boolean).length;

// Short caption phrases: they end at sentence punctuation, at a comma after a few words, or at the word limit.
function buildPhrases(scenes) {
  const phrases = [];
  let current = [];
  const flush = () => { if (current.length) phrases.push({ start: current[0].start, end: current[current.length - 1].end, words: current }); current = []; };
  for (const scene of scenes) {
    for (const word of scene.words) {
      current.push({ text: word.text, start: scene.start + word.start, end: scene.start + word.end });
      const stop = /[.?!…]$/.test(word.text) || (/[,;:]$/.test(word.text) && current.length >= 3) || current.length >= MAX_WORDS_PER_PHRASE;
      if (stop) flush();
    }
    flush();
  }
  return phrases;
}

const srtTime = seconds => {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor((ms % 3600000) / 60000))}:${pad(Math.floor((ms % 60000) / 1000))},${pad(ms % 1000, 3)}`;
};

function buildSrt(phrases) {
  return phrases.map((phrase, i) => {
    const next = phrases[i + 1];
    const end = Math.min(phrase.end + 0.3, next ? next.start - 0.02 : Infinity);
    return `${i + 1}\n${srtTime(phrase.start)} --> ${srtTime(Math.max(end, phrase.start + 0.3))}\n${phrase.words.map(word => word.text).join(' ')}`;
  }).join('\n\n') + '\n';
}


// Scene narrations grouped in order into parts of at most MAX_WORDS_PER_TTS_CALL words.
function narrationParts(scenes) {
  const parts = [];
  let current = [];
  let words = 0;
  for (const scene of scenes) {
    const text = scene.narration.trim();
    if (current.length && words + wordCount(text) > MAX_WORDS_PER_TTS_CALL) { parts.push(current.join('\n\n')); current = []; words = 0; }
    current.push(text);
    words += wordCount(text);
  }
  if (current.length) parts.push(current.join('\n\n'));
  return parts;
}

// Speaks the narration with the TTS provider and returns the provider evidence. A long narration is spoken
// part by part (each part cached by its text and voice, so a retry only redoes what failed) and joined.
async function synthesizeNarration(generator, scenes, { audioPath, partsDir, voice, log }) {
  const parts = narrationParts(scenes);
  const speak = async (text, output) => {
    for (let attempt = 1; attempt <= TTS_ATTEMPTS; attempt++) {
      try {
        await generator.generateTTSAudio(text, output);
        const result = generator.lastNarrationResult || {};
        if (result.status === 'ready') return result;
        throw new Error(`narration is ${result.status || 'unavailable'}${result.error ? `: ${result.error}` : ''}`);
      } catch (error) {
        if (attempt === TTS_ATTEMPTS) throw new Error(`Narration is not usable (${error.message}); check the provider key and quota`);
        log(`Narration attempt ${attempt} failed (${error.message}); trying again in ${attempt * 20}s`);
        await sleep(attempt * 20000);
      }
    }
    return null;
  };
  if (parts.length === 1) return speak(parts[0], audioPath);

  await fs.mkdir(partsDir, { recursive: true });
  const files = [];
  let evidence = null;
  for (let i = 0; i < parts.length; i++) {
    const file = path.join(partsDir, `${crypto.createHash('sha1').update(`${parts[i]}|${voice || ''}`).digest('hex')}.mp3`);
    files.push(file);
    if (await fs.stat(file).then(stat => stat.size > 0).catch(() => false)) { log(`Narration part ${i + 1}/${parts.length}: saved copy`); continue; }
    log(`Narration part ${i + 1}/${parts.length} (${wordCount(parts[i])} words) ...`);
    evidence = await speak(parts[i], file);
  }
  const list = path.join(partsDir, 'parts.txt');
  await fs.writeFile(list, files.map(file => `file '${file.replace(/'/g, "'\\''")}'`).join('\n') + '\n');
  await runFFmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c:a', 'libmp3lame', '-q:a', '2', audioPath]);
  return evidence || generator.lastNarrationResult || {};
}

// Two builds of the same video would delete each other's temporary files, so a second one is refused.
async function takeLock(file) {
  const holder = Number((await fs.readFile(file, 'utf8').catch(() => '')).trim());
  if (holder && holder !== process.pid) {
    let alive = true;
    try { process.kill(holder, 0); } catch (_error) { alive = false; }
    if (alive) throw new Error(`Another build of this video is already running (process ${holder})`);
  }
  await fs.writeFile(file, String(process.pid));
  return () => fs.rm(file, { force: true });
}

function projectDirs(projectDir) {
  return Object.fromEntries(['script', 'narration', 'captions', 'assets', 'render'].map(name => [name, path.join(projectDir, name)]));
}

async function readJson(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (_error) { return null; }
}

async function buildStoryVideo(storyboard, options = {}) {
  const {
    root = ROOT, forceTts = false, withStills = true, log = () => {}, aiVideoGenerator = null,
    projectDir = path.join(root, 'data', 'projects', storyboard.slug),
    videoPath = path.join(root, 'data', 'videos', `${storyboard.slug}.mp4`)
  } = options;
  validateStoryboard(storyboard);
  const language = (storyboard.language || contentLanguage()).split('-')[0];
  const previousLanguage = process.env.CONTENT_LANGUAGE;
  process.env.CONTENT_LANGUAGE = language;
  let releaseLock = async () => {};

  try {
    const dirs = projectDirs(projectDir);
    await Promise.all(Object.values(dirs).map(dir => fs.mkdir(dir, { recursive: true })));
    await fs.mkdir(path.dirname(videoPath), { recursive: true });
    releaseLock = await takeLock(path.join(projectDir, '.build.lock'));

    // 1. Script
    const narrationText = storyboard.scenes.map(scene => scene.narration.trim()).join('\n\n') + '\n';
    await fs.writeFile(path.join(dirs.script, 'storyboard.json'), JSON.stringify(storyboard, null, 2));
    await fs.writeFile(path.join(dirs.script, 'narration.txt'), narrationText);

    // 2. Narration (cached by text and voice so re-renders do not spend TTS quota)
    const audioPath = path.join(dirs.narration, 'narration.mp3');
    const metaPath = path.join(dirs.narration, 'meta.json');
    const fingerprint = crypto.createHash('sha1').update(`${narrationText}|${storyboard.voice || ''}`).digest('hex');
    let meta = await readJson(metaPath);
    const audioExists = await fs.stat(audioPath).then(stat => stat.size > 0).catch(() => false);
    if (forceTts || !meta || !audioExists || meta.fingerprint !== fingerprint) {
      log(`Generating narration with voice ${storyboard.voice || 'default'} ...`);
      let generator = aiVideoGenerator;
      if (!generator) {
        const credentials = JSON.parse(await fs.readFile(path.join(root, 'config', 'credentials.json'), 'utf8'));
        if (storyboard.voice) credentials.gemini = { ...(credentials.gemini || {}), ttsVoice: storyboard.voice };
        generator = new AIVideoGenerator(credentials);
      }
      const result = await synthesizeNarration(generator, storyboard.scenes, { audioPath, partsDir: path.join(dirs.narration, 'parts'), voice: storyboard.voice, log });
      meta = {
        fingerprint, provider: result.provider, model: result.model, voice: storyboard.voice || null,
        generatedAt: result.generatedAt, externalTaskId: result.externalTaskId || null, cost: result.cost || {}
      };
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
    } else {
      log('Reusing the saved narration (text and voice unchanged).');
    }
    const totalSeconds = (await getMediaDuration(audioPath)) + 0.6;
    log(`Narration is ${totalSeconds.toFixed(1)}s long.`);

    // 3. Word timing: whisper first, then loudness, then an estimate
    let recognised = null;
    const whisperPath = path.join(dirs.captions, 'whisper-words.json');
    if (isWhisperReady()) {
      const cacheFresh = await fs.stat(whisperPath).then(stat => meta && stat.mtimeMs > new Date(meta.generatedAt || 0).getTime()).catch(() => false);
      if (cacheFresh && !forceTts) recognised = JSON.parse(await fs.readFile(whisperPath, 'utf8'));
      else {
        log('Transcribing the narration with whisper ...');
        recognised = await transcribeWords(audioPath, { language, workDir: dirs.render });
        await fs.writeFile(whisperPath, JSON.stringify(recognised));
      }
    } else log('Whisper is not installed (npm run whisper:install); using the audio loudness for timing.');
    const envelope = await renderer.computeSpeechEnvelope(audioPath);
    const plan = storyboard.scenes.map(scene => ({ title: scene.headline, text: scene.narration, mood: scene.mood || 'neutral' }));
    const { scenes: timed, timing, share } = renderer.planTiming(plan, { recognised, envelope, totalSeconds });
    log(`Caption timing: ${timing}${share ? ` (${Math.round(share * 100)}% of the words matched)` : ''}.`);

    const scenes = timed.map((scene, i) => ({
      template: storyboard.scenes[i].template, labels: storyboard.scenes[i].labels || null, data: storyboard.scenes[i].data || {},
      headline: storyboard.scenes[i].headline, subtitle: storyboard.scenes[i].subtitle || '',
      mood: storyboard.scenes[i].mood || 'neutral', start: scene.start, duration: scene.duration
    }));
    const phrases = buildPhrases(timed);
    const captionsPath = path.join(dirs.captions, `captions.${language}.srt`);
    await fs.writeFile(captionsPath, buildSrt(phrases));
    await fs.writeFile(path.join(dirs.captions, 'words.json'), JSON.stringify(timed.map(scene => ({ headline: scene.title, start: scene.start, words: scene.words })), null, 2));

    // 4. Render
    const publicDir = path.join(dirs.render, 'public');
    await fs.rm(publicDir, { recursive: true, force: true });
    await fs.mkdir(publicDir, { recursive: true });
    await fs.copyFile(audioPath, path.join(publicDir, 'narration.mp3'));
    await fs.copyFile(path.join(root, 'remotion', 'public', 'mascot.svg'), path.join(publicDir, 'mascot.svg'));
    await fs.copyFile(path.join(root, 'remotion', 'public', 'mascot.svg'), path.join(dirs.assets, 'mascot.svg'));
    const props = { durationInSeconds: Number(totalSeconds.toFixed(3)), audioFile: 'narration.mp3', mascotFile: 'mascot.svg', mouthEnvelope: envelope, phrases, scenes };
    const propsPath = path.join(dirs.render, 'props.json');
    await fs.writeFile(propsPath, JSON.stringify(props));

    log('Rendering the video (this takes a few minutes) ...');
    await renderer.renderComposition({ composition: 'InfoVideo', outputPath: videoPath, propsPath, publicDir });
    log(`Video: ${path.relative(root, videoPath)}`);

    // 5. Thumbnail and scene stills
    const thumbnailPath = path.join(dirs.assets, 'thumbnail.png');
    const thumbProps = path.join(dirs.render, 'thumbnail-props.json');
    await fs.writeFile(thumbProps, JSON.stringify(storyboard.thumbnail || {}));
    await renderer.renderComposition({ composition: 'Thumbnail', outputPath: thumbnailPath, propsPath: thumbProps, publicDir, frame: 0 });
    log(`Thumbnail: ${path.relative(root, thumbnailPath)}`);
    const stills = [];
    if (withStills) {
      await fs.mkdir(path.join(dirs.assets, 'scenes'), { recursive: true });
      for (let i = 0; i < scenes.length; i++) {
        const middle = Math.round((scenes[i].start + Math.min(scenes[i].duration * 0.7, 4.5)) * 30);
        const output = path.join(dirs.assets, 'scenes', `${String(i + 1).padStart(2, '0')}-${scenes[i].template}.png`);
        await renderer.renderComposition({ composition: 'InfoVideo', propsPath, publicDir, frame: Math.min(middle, Math.round(totalSeconds * 30) - 1), outputPath: output });
        stills.push(output);
      }
      log(`Scene stills: ${scenes.length} files in ${path.relative(root, path.join(dirs.assets, 'scenes'))}`);
    }
    await fs.rm(publicDir, { recursive: true, force: true });

    return {
      slug: storyboard.slug, projectDir, dirs, videoPath, thumbnailPath, captionsPath, audioPath, narrationMeta: meta,
      durationSeconds: totalSeconds, timing, share, scenes, stills, language
    };
  } finally {
    await releaseLock();
    if (previousLanguage === undefined) delete process.env.CONTENT_LANGUAGE; else process.env.CONTENT_LANGUAGE = previousLanguage;
  }
}

module.exports = { buildStoryVideo, buildPhrases, buildSrt, projectDirs, narrationParts };
