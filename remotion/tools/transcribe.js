// Runs whisper.cpp on a 16 kHz mono WAV and prints one JSON array of words with timestamps (seconds).
// Spawned as a child process by utils/speech-aligner.js so whisper's scratch files land in the caller's
// working directory and a crash cannot take the agent down.
const path = require('path');
const { transcribe } = require('@remotion/install-whisper-cpp');

const [, , inputPath, language, model] = process.argv;
const ROOT = path.join(__dirname, '..', '.whisper');

(async () => {
  const result = await transcribe({
    inputPath,
    whisperPath: path.join(ROOT, 'whisper.cpp'),
    whisperCppVersion: '1.5.5',
    model: model || 'small',
    modelFolder: path.join(ROOT, 'models'),
    tokenLevelTimestamps: true,
    language: language || null,
    printOutput: false
  });

  // Tokens are sub-word pieces: a token that starts with a space begins a new word.
  const words = [];
  for (const segment of result.transcription) {
    for (const token of segment.tokens || []) {
      if (!token.text || token.text.startsWith('[_') || /^\s*$/.test(token.text)) continue;
      const startsWord = /^\s/.test(token.text) || !words.length;
      const start = token.offsets.from / 1000;
      const end = token.offsets.to / 1000;
      if (startsWord) words.push({ text: token.text.trim(), start, end });
      else {
        const last = words[words.length - 1];
        last.text += token.text;
        last.end = Math.max(last.end, end);
      }
    }
  }
  process.stdout.write(`\n@@WORDS@@${JSON.stringify(words)}`);
})().catch(error => {
  process.stderr.write(String(error && error.message ? error.message : error));
  process.exit(1);
});
