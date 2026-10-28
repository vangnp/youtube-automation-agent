// Turns an approved script into a storyboard (scenes, templates, data, narration) for the canvas video
// renderer. The AI model plans the scenes; utils/story-templates.js cleans whatever it returns, and a
// deterministic fallback builds a plain storyboard when no model is available or its answer is unusable.
const { Logger } = require('./logger');
const { narrationSegments } = require('./narration-script');
const { TEMPLATE_GUIDE, MOODS, clip, pickIcon, sanitizeStoryboard } = require('./story-templates');
const { lengthProfile } = require('./video-length');

const logger = new Logger('StoryboardWriter');

const plain = value => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// First JSON object in a model answer, with or without a markdown fence around it.
function extractJson(answer) {
  const text = String(answer || '').replace(/```(?:json)?/gi, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('The storyboard answer contains no JSON object');
  return JSON.parse(text.slice(start, end + 1));
}

function scriptDigest(script, language) {
  const segments = narrationSegments(script, language);
  const claims = (script.claims || []).map(claim => plain(claim.claim || claim.text || claim)).filter(Boolean);
  return [
    `Title: ${plain(script.title)}`,
    ...segments.map(segment => `[${segment.kind}] ${segment.title ? `${segment.title}: ` : ''}${plain(segment.text)}`),
    claims.length ? `Claims the script relies on: ${claims.join(' | ')}` : ''
  ].filter(Boolean).join('\n');
}

function buildPrompt({ script, strategy, language }) {
  const profile = lengthProfile(strategy?.requestedLengthKey);
  return `You are the storyboard writer for "Yang Tò Mò", a short vertical explainer channel narrated by Yang, a friendly ram-lion mascot.
Turn the approved script below into a storyboard for ONE video of ${profile.label}. Language of all text: ${language === 'vi' ? 'Vietnamese' : language}.

Return only valid JSON of this shape:
{"title":"video title","thumbnail":{"title":"TWO SHORT\\nLINES","kicker":"MAX 18 CHARS","icon":"<icon>"},"description":"2-3 sentence YouTube description","tags":["tag"],
 "scenes":[{"template":"<template>","mood":"<mood>","headline":"max 28 chars","subtitle":"max 34 chars","data":{},"narration":"what Yang says in this scene"}]}

${TEMPLATE_GUIDE}

Rules:
- ${profile.scenes[0]} to ${profile.scenes[1]} scenes and ${profile.words[0]} to ${profile.words[1]} words of narration in total (about 3.3 words per second); each narration is 2 to 4 spoken sentences of at most 55 words.
- Teach, do not just list: for every key idea say WHAT it is, WHY it works, a worked example with numbers, and where it stops working. Spend several scenes on the central idea of the script before moving on.
- Scene 1 is the hook (template big_question, mood curious). The last scene is outro_generic with a short call to subscribe and an invitation to comment.
- Use only facts, numbers and claims that appear in the script; do not invent statistics. When the script uses rates, prices or regions, say the assumption aloud.
- If the topic involves money, health or safety, include one "note" scene with a short disclaimer (educational, not advice).
- Use a different template for neighbouring scenes and pick the one that SHOWS the idea: formula or big_number for calculations, bar_chart for compared values, steps for a process, compare for two options, percent for a share of a whole, timeline for history, icon_scene or list_points otherwise.
- The data of a scene must show exactly what its narration says (same numbers, same words). Write numbers as digits in the narration; they are spelled out for the voice automatically.
- Scene 1 opens with the greeting from the script's intro, said once (for example "Xin chào, Yang đây!"), then the hook question. Never greet again in a later scene. Friendly, informal "bạn"; Yang calls themself "Yang". No filler, no repeated sentences.
- Channel objective: ${plain(strategy?.objective || '')}

Approved script:
${scriptDigest(script, language)}`;
}

// A plain storyboard straight from the script text, used when no model is available.
function fallbackStoryboard({ script, language, voice, slug }) {
  const segments = narrationSegments(script, language);
  const sentences = text => plain(text).split(/(?<=[.!?])\s+/).filter(Boolean);
  const words = text => text.split(/\s+/).filter(Boolean);
  const limit = (text, max = 40) => words(text).slice(0, max).join(' ');
  const scenes = [];

  const hook = segments.find(segment => segment.kind === 'hook');
  const hookText = hook ? limit(sentences(hook.text).slice(0, 2).join(' ')) : plain(script.title);
  scenes.push({ template: 'big_question', mood: 'curious', headline: clip(plain(script.title), 28), subtitle: '', data: { icon: pickIcon(script.title), text: 'BẠN CÓ BIẾT?', caption: '' }, narration: hookText });

  const sections = segments.filter(segment => segment.kind === 'section').slice(0, 5);
  sections.forEach((segment, index) => {
    const body = sentences(segment.text.split('\n').slice(1).join(' '));
    if (!body.length) return;
    const items = body.slice(0, 3).map(sentence => ({ text: clip(sentence, 48), icon: pickIcon(sentence) }));
    const template = items.length >= 2 ? 'list_points' : 'icon_scene';
    scenes.push({
      template, mood: index % 2 ? 'happy' : 'neutral', headline: clip(segment.title, 28), subtitle: '',
      data: template === 'list_points' ? { items } : { icon: pickIcon(segment.title), callouts: [] },
      narration: limit(body.slice(0, 3).join(' '))
    });
  });

  return sanitizeStoryboard({
    title: script.title, scenes,
    thumbnail: { title: clip(plain(script.title), 28), kicker: 'KHOA HỌC VUI', icon: pickIcon(script.title) },
    description: plain(script.hook?.text || ''), tags: script.keywords || []
  }, { slug, language, voice, title: script.title });
}

async function writeStoryboard({ script, strategy = {}, aiTextService = null, language = 'vi', voice = null, slug = null }) {
  const base = { slug, language, voice, title: plain(script.title), description: plain(script.hook?.text || ''), tags: script.keywords || [] };
  if (aiTextService?.isAvailable?.()) {
    try {
      const answer = await aiTextService.generateText(buildPrompt({ script, strategy, language }), { maxTokens: lengthProfile(strategy?.requestedLengthKey).storyboardTokens, temperature: 0.6 });
      const { storyboard, warnings } = sanitizeStoryboard(extractJson(answer), base);
      warnings.forEach(warning => logger.warn(warning));
      logger.info(`Storyboard planned by ${aiTextService.providerName || 'the AI model'}: ${storyboard.scenes.length} scenes`);
      return { storyboard, source: 'ai', warnings };
    } catch (error) {
      logger.warn(`AI storyboard failed (${error.message}); building a plain storyboard from the script`);
    }
  }
  const { storyboard, warnings } = fallbackStoryboard({ script, language, voice, slug });
  return { storyboard, source: 'fallback', warnings };
}

module.exports = { writeStoryboard, fallbackStoryboard, buildPrompt, extractJson, MOODS };
