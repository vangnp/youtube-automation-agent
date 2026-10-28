// Pure SVG animation helpers, kept free of React so they can also run in Node (previews and tests).
// The mascot SVG keeps its parts in named groups (eye-left, eye-right, eyebrows, nose-mouth, head,
// prop-lightbulb). We load the SVG text once and rewrite those groups for every frame, so the
// character blinks, talks, changes expression, tilts its head and swings its lightbulb without
// extra artwork. Moods: neutral, happy, surprised, curious, sad, wink.

// public/mascot.svg is fully assembled (built by data/mascot-preview/suits/build-suits.js), so only the
// animation transforms are applied here. VIEWBOX hugs the character, with room for head tilt, bulb swing
// and the ?/! marks.
const VIEWBOX = '200 305 712 940';
const [, , VIEW_WIDTH, VIEW_HEIGHT] = VIEWBOX.split(' ').map(Number);

const BLINK_EVERY = 3.4;
const BLINK_LENGTH = 0.16;
const STROKE = '#4D2B1A';

const NOSE = '<path d="M465 451 Q480 439 495 451 Q488 466 480 467 Q471 465 465 451Z" fill="#D68B4B" stroke="#704021" stroke-width="5" stroke-linejoin="round"/>';
const SMILE_LINES = '<path d="M480 466 Q477 487 457 487 M480 466 Q487 486 507 480" fill="none" stroke="#704021" stroke-width="6" stroke-linecap="round"/>';
const OPEN_MOUTH = '<path d="M458 486 Q480 508 506 481 Q502 514 481 515 Q464 512 458 486Z" fill="#D9514E" stroke="#704021" stroke-width="5" stroke-linejoin="round"/><path d="M468 492 Q482 498 497 490" fill="none" stroke="#FFF1DC" stroke-width="6" stroke-linecap="round"/>';

const BROWS = {
  neutral: ['M386 391 Q405 370 426 388', 'M535 389 Q555 370 575 393'],
  happy: ['M386 384 Q405 364 426 382', 'M535 382 Q555 364 575 386'],
  wink: ['M386 384 Q405 364 426 382', 'M535 396 Q555 392 575 400'],
  surprised: ['M386 372 Q405 348 426 366', 'M535 366 Q555 348 575 372'],
  curious: ['M386 376 Q405 354 426 372', 'M535 396 Q555 388 575 398'],
  sad: ['M386 390 Q408 384 428 368', 'M533 368 Q553 384 575 390']
};

function blinkScale(seconds) {
  const phase = (seconds + 1.1) % BLINK_EVERY;
  const start = BLINK_EVERY - BLINK_LENGTH;
  if (phase < start) return 1;
  const t = (phase - start) / BLINK_LENGTH;
  return 1 - 0.92 * Math.sin(Math.PI * t);
}

const arcEye = (id, cx) =>
  `<g id="${id}"><path d="M${cx - 30} 436 Q${cx} 394 ${cx + 30} 436" fill="none" stroke="${STROKE}" stroke-width="9" stroke-linecap="round"/></g>`;

function grab(source, id) {
  const match = source.match(new RegExp(`<g id="${id}">[\\s\\S]*?</g>`));
  return match ? match[0] : null;
}

function scaledEye(group, id, cx, cy, scaleX, scaleY) {
  return group.replace(
    `<g id="${id}">`,
    `<g id="${id}" transform="translate(${cx} ${cy}) scale(${scaleX.toFixed(3)} ${scaleY.toFixed(3)}) translate(${-cx} ${-cy})">`
  );
}

function mouthMarkup(mood, open) {
  if (mood === 'surprised') {
    const ry = 15 + 12 * open;
    return `<g id="nose-mouth">${NOSE}<ellipse cx="480" cy="${(492 + ry * 0.3).toFixed(1)}" rx="${(13 + 4 * open).toFixed(1)}" ry="${ry.toFixed(1)}" fill="#D9514E" stroke="#704021" stroke-width="5"/></g>`;
  }
  if (mood === 'sad') {
    return `<g id="nose-mouth">${NOSE}<path d="M480 466 L480 480 M456 508 Q480 486 504 508" fill="none" stroke="#704021" stroke-width="6" stroke-linecap="round"/></g>`;
  }
  const wide = mood === 'happy' || mood === 'wink' ? 1.12 : 1;
  const grow = 1 + 0.4 * open;
  return `<g id="nose-mouth" transform="translate(480 486) scale(${wide} ${grow.toFixed(3)}) translate(-480 -486)">${NOSE}${SMILE_LINES}${OPEN_MOUTH}</g>`;
}

function markMarkup(mood, age) {
  const glyph = mood === 'curious' ? '?' : mood === 'surprised' ? '!' : null;
  if (!glyph) return '';
  // Damped overshoot so the mark pops in when the mood changes.
  const pop = 1 - Math.exp(-age * 11) * Math.cos(age * 15);
  return `<text x="770" y="420" font-size="128" font-weight="800" font-family="Arial, Helvetica, sans-serif" fill="#FFD23F" stroke="#67391F" stroke-width="8" paint-order="stroke" text-anchor="middle" transform="translate(770 360) rotate(12) scale(${Math.max(0, pop).toFixed(3)}) translate(-770 -360)">${glyph}</text>`;
}

function renderSvg(source, { seconds, mouthOpen, mood, moodAge }) {
  const blink = blinkScale(seconds);
  const head = Math.sin(seconds * 1.3) * (mood === 'curious' ? 3.2 : 1.6) + (mood === 'sad' ? 3 : 0);
  const bulb = Math.sin(seconds * 2.1) * 3.5;
  const bulbPulse = 1 + 0.025 * Math.sin(seconds * 3.2);

  const leftOriginal = grab(source, 'eye-left');
  const rightOriginal = grab(source, 'eye-right');
  const lift = mood === 'surprised' ? 1.12 : 1;
  const left = mood === 'happy' || mood === 'wink'
    ? arcEye('eye-left', 410)
    : scaledEye(leftOriginal, 'eye-left', 410, 426, lift, lift * blink)
      + (mood === 'sad' ? '<path d="M388 470 Q376 492 388 503 Q400 492 388 470Z" fill="#8FD3F7" stroke="#4A9BD0" stroke-width="3"/>' : '');
  const right = mood === 'happy'
    ? arcEye('eye-right', 551)
    : scaledEye(rightOriginal, 'eye-right', 551, 426, lift, lift * blink);

  const [browLeft, browRight] = BROWS[mood] || BROWS.neutral;
  const brows = `<g id="eyebrows" fill="none" stroke="#744325" stroke-width="9" stroke-linecap="round"><path d="${browLeft}"/><path d="${browRight}"/></g>`;

  const body = source
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(leftOriginal, left)
    .replace(rightOriginal, right)
    .replace(/<g id="eyebrows"[\s\S]*?<\/g>/, brows)
    .replace(/<g id="nose-mouth">[\s\S]*?<\/g>/, mouthMarkup(mood, mouthOpen))
    .replace('<g id="head" filter="url(#softShadow)">', `<g id="head" filter="url(#softShadow)" transform="rotate(${head.toFixed(2)} 480 600)">`)
    .replace('<g id="prop-lightbulb" filter="url(#softShadow)">', `<g id="prop-lightbulb" filter="url(#softShadow)" transform="translate(800 500) rotate(${bulb.toFixed(2)}) scale(${bulbPulse.toFixed(3)}) translate(-800 -500)">`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" width="100%" height="100%">${body}${markMarkup(mood, moodAge)}</svg>`;
}

// envelope: loudness 0..1 for every frame of the narration (measured from the real audio).
// words: [{start, end}] in absolute seconds, used only when no envelope is available.
// moods: [{start, mood}] in absolute seconds, sorted.

module.exports = { renderSvg, blinkScale, VIEWBOX, VIEW_WIDTH, VIEW_HEIGHT };
