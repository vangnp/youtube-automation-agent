// One-time setup of local speech timing: builds whisper.cpp and downloads a multilingual model into
// remotion/.whisper. Needs git, make and a C++ compiler. Model size is the only trade-off:
//   WHISPER_MODEL=base   (~140 MB, fastest)   small (~470 MB, default)   medium (~1.5 GB, best)
const fs = require('fs');
const path = require('path');
const { installWhisperCpp, downloadWhisperModel } = require('@remotion/install-whisper-cpp');

const ROOT = path.join(__dirname, '..', '.whisper');
const VERSION = '1.5.5';
const MODEL = process.env.WHISPER_MODEL || 'small';

(async () => {
  console.log(`Installing whisper.cpp ${VERSION} into ${ROOT} ...`);
  await installWhisperCpp({ to: path.join(ROOT, 'whisper.cpp'), version: VERSION, printOutput: true });
  fs.mkdirSync(path.join(ROOT, 'models'), { recursive: true });
  console.log(`Downloading the "${MODEL}" model ...`);
  await downloadWhisperModel({ model: MODEL, folder: path.join(ROOT, 'models'), printOutput: true });
  console.log('Whisper is ready.');
})().catch(error => {
  console.error('Whisper setup failed:', error.message);
  process.exit(1);
});
