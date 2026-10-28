// Shared drawing helpers for the flat-infographic canvas scenes (palette, easing, text, pills, cards).
// Every helper draws synchronously on a 2D context; nothing here keeps state between frames.
export const INK = '#242522';
export const PAPER = '#F2EFE5';
export const PANEL = '#E9E7DE';
export const RED = '#B84E4F';
export const GREEN = '#4E8A74';
export const BLUE = '#3F78A5';
export const WATER = '#8EC5E3';
export const WATER_DEEP = '#5A9BC6';
export const ICE = '#E8F8FD';
export const ICE_SHADE = '#BFE6F5';
export const GOLD = '#E9B949';
export const WHITE = '#FFFDF8';


export const PINK = '#EFA9A4';
export const ORANGE = '#E8894A';
export const PURPLE = '#7C6BB0';
export const WOOD = '#C9B488';
export const FONT = 'Arial, Helvetica, sans-serif';

export const clamp01 = x => Math.min(1, Math.max(0, x));
export const ease = x => 1 - Math.pow(1 - clamp01(x), 3);
export const back = x => { const c = 1.9; const v = clamp01(x) - 1; return 1 + (c + 1) * v * v * v + c * v * v; };
export const seeded = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function stroke(ctx, width = 6, color = INK) {
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

export function text(ctx, value, x, y, { size = 34, color = INK, align = 'center', weight = 800 } = {}) {
  ctx.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

// A coloured label pill that pops in at `appear` seconds.
export function pill(ctx, label, x, y, color, t, appear = 0, size = 32) {
  if (!label) return;
  const k = back((t - appear) / 0.45);
  if (k <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.font = `800 ${size}px Arial, Helvetica, sans-serif`;
  const width = ctx.measureText(label).width + 56;
  const height = size + 30;
  roundRect(ctx, -width / 2, -height / 2, width, height, 14);
  ctx.fillStyle = color;
  ctx.fill();
  stroke(ctx, 4);
  text(ctx, label, 0, 2, { size, color: WHITE });
  ctx.restore();
}

export function card(ctx, label, x, y, color, t, appear = 0, size = 34, minWidth = 0) {
  const k = back((t - appear) / 0.45);
  if (k <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.font = `800 ${size}px Arial, Helvetica, sans-serif`;
  const width = Math.max(minWidth, ctx.measureText(label).width + 44);
  const height = size + 28;
  roundRect(ctx, -width / 2, -height / 2, width, height, 16);
  ctx.fillStyle = WHITE;
  ctx.fill();
  stroke(ctx, 5);
  text(ctx, label, 0, 2, { size, color });
  ctx.restore();
}

export function sparkle(ctx, x, y, r, color = GOLD) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 - Math.PI / 2;
    const radius = i % 2 ? r * 0.32 : r;
    ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  stroke(ctx, 3);
}

// Shrinks the font until the string fits `maxWidth` (down to `min`), then draws it.
export function fitText(ctx, value, x, y, { size = 34, min = 16, maxWidth = 400, color = INK, align = 'center', weight = 800 } = {}) {
  let fontSize = size;
  ctx.font = `${weight} ${fontSize}px ${FONT}`;
  while (fontSize > min && ctx.measureText(value).width > maxWidth) {
    fontSize -= 2;
    ctx.font = `${weight} ${fontSize}px ${FONT}`;
  }
  text(ctx, value, x, y, { size: fontSize, color, align, weight });
  return fontSize;
}

// Greedy word wrap for the current font settings; never returns more than `maxLines` lines.
export function wrapLines(ctx, value, maxWidth, { size = 34, weight = 800, maxLines = 3 } = {}) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  const words = String(value || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(trial).width > maxWidth) { lines.push(line); line = word; } else line = trial;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] += '…';
    return kept;
  }
  return lines;
}

// Wrapped, vertically centred text block; returns the font size used. Shrinks until it fits `maxLines`.
export function paragraph(ctx, value, x, y, { maxWidth = 400, size = 34, min = 22, maxLines = 2, color = INK, align = 'center', weight = 800, lineHeight = 1.18 } = {}) {
  let fontSize = size;
  let lines = wrapLines(ctx, value, maxWidth, { size: fontSize, weight, maxLines: 99 });
  while (lines.length > maxLines && fontSize > min) {
    fontSize -= 2;
    lines = wrapLines(ctx, value, maxWidth, { size: fontSize, weight, maxLines: 99 });
  }
  lines = lines.length > maxLines ? wrapLines(ctx, value, maxWidth, { size: fontSize, weight, maxLines }) : lines;
  const step = fontSize * lineHeight;
  lines.forEach((line, i) => text(ctx, line, x, y + (i - (lines.length - 1) / 2) * step, { size: fontSize, color, align, weight }));
  return { size: fontSize, lines: lines.length };
}
