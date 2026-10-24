const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { getFFmpegPath } = require('./ffmpeg');
const { narrationSegments } = require('./narration-script');
const { contentLanguage } = require('./content-language');

const execFileAsync = promisify(execFile);

const REMOTION_DIR = path.join(__dirname, '..', 'remotion');
const FPS = 30;
const FADE_SECONDS = 0.5;
const MIN_SCENE_SECONDS = 2;
// The channel mascot: an SVG with named groups (eyes, mouth, head, lightbulb) that the composition
// animates. Override with MASCOT_FILE, or turn it off with REMOTION_MASCOT=off.
const DEFAULT_MASCOT = path.join(REMOTION_DIR, 'public', 'mascot.svg');

function remotionBinary() {
  const name = process.platform === 'win32' ? 'remotion.cmd' : 'remotion';
  return path.join(REMOTION_DIR, 'node_modules', '.bin', name);
}

// Opt-in: VIDEO_RENDERER=remotion, and `npm run remotion:install` must have been run.
function isRemotionEnabled() {
  return String(process.env.VIDEO_RENDERER || '').toLowerCase() === 'remotion';
}

function isRemotionInstalled() {
  return fsSync.existsSync(remotionBinary());
}

function resolveMascotFile() {
  if (String(process.env.REMOTION_MASCOT || '').toLowerCase() === 'off') return null;
  const candidate = process.env.MASCOT_FILE ? path.resolve(process.env.MASCOT_FILE) : DEFAULT_MASCOT;
  return fsSync.existsSync(candidate) ? candidate : null;
}

function plainText(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// The mascot's face follows the beat of the script: curious at the hook, a mix in the body, happy at the end.
function moodFor(segment, sectionIndex) {
  if (segment.kind === 'hook') return 'curious';
  if (segment.kind === 'intro') return 'happy';
  if (segment.kind === 'conclusion') return 'happy';
  if (segment.kind === 'cta') return 'wink';
  if (/\?/.test(segment.text)) return 'curious';
  if (/!/.test(segment.text)) return 'surprised';
  return ['neutral', 'surprised', 'happy'][sectionIndex % 3];
}

// One scene per narrated part, in the order (and with the exact words) the narrator reads them.
function buildScenePlan(script = {}, language = contentLanguage()) {
  let sectionIndex = 0;
  return narrationSegments(script, language).map(segment => ({
    title: segment.title,
    text: plainText(segment.text),
    mood: moodFor(segment, segment.kind === 'section' ? sectionIndex++ : 0)
  }));
}

function wordWeights(words) {
  return words.map(word => Math.max(2, word.length) + (/[.,!?;:]$/.test(word) ? 3 : 0));
}

// Fallback when the audio cannot be analysed: spread each scene's duration over its words by length.
function estimateWordTimings(text, duration) {
  const words = plainText(text).split(' ').filter(Boolean);
  if (!words.length) return [];
  const weights = wordWeights(words);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const usable = Math.max(0.5, duration - 0.3);
  let cursor = 0.15;
  return words.map((word, index) => {
    const span = (weights[index] / total) * usable;
    const entry = { text: word, start: Number(cursor.toFixed(3)), end: Number((cursor + span).toFixed(3)) };
    cursor += span;
    return entry;
  });
}

function allocateDurations(scenes, totalSeconds) {
  const counts = scenes.map(scene => Math.max(1, plainText(scene.text).split(' ').filter(Boolean).length));
  const countTotal = counts.reduce((sum, count) => sum + count, 0);
  const overlap = FADE_SECONDS * Math.max(0, scenes.length - 1);
  const budget = totalSeconds + overlap;
  const raw = counts.map(count => Math.max(MIN_SCENE_SECONDS, (count / countTotal) * budget));
  const scale = budget / raw.reduce((sum, seconds) => sum + seconds, 0);
  return raw.map(seconds => Number((seconds * scale).toFixed(3)));
}

/**
 * Loudness of the narration for every video frame, 0..1. Silence is exactly 0, so the mascot's mouth
 * closes in pauses, and the same curve tells us where speech really happens.
 */
async function computeSpeechEnvelope(audioPath, fps = FPS) {
  const rate = 8000;
  const { stdout } = await execFileAsync(
    getFFmpegPath(),
    ['-v', 'error', '-i', audioPath, '-ac', '1', '-ar', String(rate), '-f', 's16le', '-'],
    { encoding: 'buffer', maxBuffer: 512 * 1024 * 1024 }
  );
  const samples = Math.floor(stdout.length / 2);
  const window = Math.round(rate / fps);
  const frames = Math.floor(samples / window);
  const rms = new Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let i = 0; i < window; i++) {
      const value = stdout.readInt16LE((f * window + i) * 2) / 32768;
      sum += value * value;
    }
    rms[f] = Math.sqrt(sum / window);
  }
  if (!frames) return [];
  const sorted = [...rms].sort((a, b) => a - b);
  const reference = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1] || 1;
  const envelope = [];
  let previous = 0;
  for (let f = 0; f < frames; f++) {
    const level = Math.min(1, rms[f] / (reference || 1));
    const gated = level < 0.1 ? 0 : level;
    previous = Math.max(gated, previous * 0.55);
    envelope.push(Number((gated === 0 && previous < 0.12 ? 0 : previous).toFixed(2)));
  }
  return envelope;
}

/**
 * Place every word where it is actually spoken. All words share the narrator's voiced time in
 * proportion to their length, so pauses never absorb a word and each scene starts when its first
 * word is heard. Returns null when the audio has too little speech to trust.
 */
function alignToSpeech(plan, envelope, totalSeconds, fps = FPS) {
  if (!envelope || envelope.length < fps) return null;
  const voiced = envelope.map(level => level > 0.12);
  const cumulative = [0];
  voiced.forEach(isVoiced => cumulative.push(cumulative[cumulative.length - 1] + (isVoiced ? 1 : 0)));
  const voicedTotal = cumulative[cumulative.length - 1];
  if (voicedTotal < fps) return null;

  const sceneWords = plan.map(scene => plainText(scene.text).split(' ').filter(Boolean));
  if (sceneWords.some(words => !words.length)) return null;
  const weights = sceneWords.map(wordWeights);
  const weightTotal = weights.flat().reduce((sum, weight) => sum + weight, 0);

  // Voiced-frame count -> the frame where that much speech has been heard.
  const frameAtVoiced = target => {
    let low = 0;
    let high = envelope.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (cumulative[mid + 1] >= target) high = mid;
      else low = mid + 1;
    }
    return low;
  };

  let heard = 0;
  const timed = sceneWords.map((words, sceneIndex) =>
    words.map((text, wordIndex) => {
      const weight = weights[sceneIndex][wordIndex];
      const start = frameAtVoiced((heard / weightTotal) * voicedTotal + 0.001) / fps;
      heard += weight;
      const end = frameAtVoiced((heard / weightTotal) * voicedTotal) / fps;
      return { text, start, end: Math.max(end, start + 0.08) };
    })
  );

  const lead = 0.15;
  const starts = timed.map((words, index) => (index === 0 ? 0 : Math.max(0, words[0].start - lead)));
  return plan.map((scene, index) => {
    const start = starts[index];
    const end = index === plan.length - 1 ? totalSeconds : starts[index + 1];
    return {
      ...scene,
      start: Number(start.toFixed(3)),
      duration: Number(Math.max(0.5, end - start).toFixed(3)),
      words: timed[index].map(word => ({
        text: word.text,
        start: Number((word.start - start).toFixed(3)),
        end: Number((word.end - start).toFixed(3))
      }))
    };
  });
}

function buildRenderProps({
  script, imageNames, audioName, mascotName = null, envelope = null, totalSeconds, width = 1920, height = 1080,
  language = contentLanguage()
}) {
  const plan = buildScenePlan(script, language);
  if (!plan.length) throw new Error('The script has no scenes to render');

  const aligned = alignToSpeech(plan, envelope, totalSeconds);
  let scenes;
  if (aligned) {
    scenes = aligned.map((scene, index) => ({
      title: scene.title, body: scene.text, mood: scene.mood,
      image: imageNames.length ? imageNames[index % imageNames.length] : null,
      start: scene.start, duration: scene.duration, words: scene.words
    }));
  } else {
    const durations = allocateDurations(plan, totalSeconds);
    scenes = plan.map((scene, index) => ({
      title: scene.title, body: scene.text, mood: scene.mood,
      image: imageNames.length ? imageNames[index % imageNames.length] : null,
      duration: durations[index], words: estimateWordTimings(scene.text, durations[index])
    }));
  }
  return {
    width, height,
    audioFile: audioName || null,
    mascotFile: mascotName || null,
    mouthEnvelope: envelope || [],
    aligned: Boolean(aligned),
    durationInSeconds: totalSeconds,
    scenes
  };
}

/**
 * Render the production with Remotion into outputPath (an MP4 that already contains the narration).
 * Throws on any failure so the caller can fall back to the FFmpeg slideshow.
 */
async function renderWithRemotion({ script, imagePaths = [], audioPath, outputPath, totalSeconds, logger = console }) {
  if (!isRemotionInstalled()) {
    throw new Error('Remotion is not installed. Run: npm run remotion:install');
  }

  const jobDir = await fs.mkdtemp(path.join(path.dirname(outputPath), 'remotion_job_'));
  try {
    const publicDir = path.join(jobDir, 'public');
    await fs.mkdir(publicDir, { recursive: true });

    const imageNames = [];
    for (let i = 0; i < imagePaths.length; i++) {
      const name = `image_${i}${path.extname(imagePaths[i]).toLowerCase()}`;
      await fs.copyFile(imagePaths[i], path.join(publicDir, name));
      imageNames.push(name);
    }
    let audioName = null;
    let envelope = null;
    if (audioPath) {
      audioName = `narration${path.extname(audioPath).toLowerCase() || '.mp3'}`;
      await fs.copyFile(audioPath, path.join(publicDir, audioName));
      try {
        envelope = await computeSpeechEnvelope(audioPath);
      } catch (error) {
        logger.warn(`Could not analyse the narration, so lip-sync and captions use estimates: ${error.message}`);
      }
    }

    let mascotName = null;
    const mascotFile = resolveMascotFile();
    if (mascotFile) {
      mascotName = 'mascot.svg';
      await fs.copyFile(mascotFile, path.join(publicDir, mascotName));
    }

    const props = buildRenderProps({ script, imageNames, audioName, mascotName, envelope, totalSeconds });
    const propsPath = path.join(jobDir, 'props.json');
    await fs.writeFile(propsPath, JSON.stringify(props), 'utf8');

    logger.info(`Rendering ${props.scenes.length} scene(s) with Remotion (${props.durationInSeconds.toFixed(1)}s, ${props.aligned ? 'speech-aligned' : 'estimated'} timing)...`);
    const args = [
      'render', 'src/index.jsx', 'LumenVideo', path.resolve(outputPath),
      `--props=${propsPath}`, `--public-dir=${publicDir}`,
      '--codec=h264', '--log=error', '--overwrite'
    ];
    if (process.env.REMOTION_CONCURRENCY) args.push(`--concurrency=${process.env.REMOTION_CONCURRENCY}`);

    // execFile with an argument array: no shell, no interpolation of script text into a command line.
    await execFileAsync(remotionBinary(), args, {
      cwd: REMOTION_DIR,
      maxBuffer: 64 * 1024 * 1024,
      timeout: Number(process.env.REMOTION_TIMEOUT_MS) || 30 * 60 * 1000
    });

    await fs.access(outputPath);
    return outputPath;
  } finally {
    await fs.rm(jobDir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = {
  isRemotionEnabled,
  isRemotionInstalled,
  renderWithRemotion,
  computeSpeechEnvelope,
  alignToSpeech,
  buildScenePlan,
  buildRenderProps,
  estimateWordTimings,
  allocateDurations
};
