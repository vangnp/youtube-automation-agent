#!/usr/bin/env node
/**
 * Build one finished vertical video from a storyboard JSON file:
 *
 *   npm run video:story -- storyboards/da-noi-tren-nuoc.json [--force-tts] [--no-stills]
 *
 * The finished video goes to data/videos/<slug>.mp4; the script, narration, captions and images live in
 * data/projects/<slug>/ (see utils/story-video-builder.js). The production agent calls the same builder
 * with a storyboard it writes from the AI script, so a hand-written file and an agent run look alike.
 */
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { buildStoryVideo } = require('../utils/story-video-builder');

const log = message => console.log(`[story] ${message}`);

async function main() {
  const args = process.argv.slice(2);
  const file = args.find(arg => !arg.startsWith('--'));
  if (!file) throw new Error('Usage: npm run video:story -- <storyboard.json> [--force-tts] [--no-stills]');
  const storyboard = JSON.parse(await fs.readFile(path.resolve(file), 'utf8'));
  await buildStoryVideo(storyboard, { forceTts: args.includes('--force-tts'), withStills: !args.includes('--no-stills'), log });
  log('Done.');
}

main().catch(error => { console.error(`[story] FAILED: ${error.message}`); process.exit(1); });
