// Topic-independent infographic templates. A storyboard scene names one of these and supplies `data`
// (and optionally `labels`); the shapes are validated in utils/story-templates.js before rendering.
// Like every canvas scene they are pure functions of (ctx, { t, labels, data }) on a 980x800 panel.
import {
  INK, WHITE, GOLD, RED, GREEN, BLUE, ORANGE, PURPLE, PANEL,
  clamp01, ease, back, roundRect, stroke, text, pill, sparkle, fitText, paragraph
} from './canvas-kit.js';
import { drawIcon } from './canvas-icons.js';

const W = 980;
const H = 800;
const ACCENTS = [RED, BLUE, GREEN, ORANGE, PURPLE];
const arr = value => (Array.isArray(value) ? value : []);
const str = value => (value === undefined || value === null ? '' : String(value));
const at = (t, start, length = 0.45) => back((t - start) / length);

function pop(ctx, k, x, y, draw) {
  if (k <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); draw(); ctx.restore();
}

// Same pop-in, but the drawing keeps absolute coordinates and scales around the pivot (px, py).
function popAbs(ctx, k, px, py, draw) {
  if (k <= 0) return;
  ctx.save(); ctx.translate(px, py); ctx.scale(k, k); ctx.translate(-px, -py); draw(); ctx.restore();
}

function box(ctx, x, y, w, h, fill = WHITE, radius = 22, width = 5) {
  roundRect(ctx, x, y, w, h, radius); ctx.fillStyle = fill; ctx.fill(); stroke(ctx, width);
}

function floating(ctx, value, x, y, size, color, t, phase) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 2 + phase) * 10);
  ctx.rotate(Math.sin(t * 1.5 + phase) * 0.18);
  ctx.font = `900 ${size}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = 14; ctx.strokeStyle = INK; ctx.strokeText(value, 0, 0);
  ctx.fillStyle = color; ctx.fillText(value, 0, 0);
  ctx.restore();
}

function dotted(ctx, from, to, color = INK) {
  ctx.save(); ctx.setLineDash([2, 14]);
  ctx.beginPath(); ctx.moveTo(from[0], from[1]); ctx.lineTo(to[0], to[1]); stroke(ctx, 7, color);
  ctx.restore();
}

// ---------------------------------------------------------------- hook: a big icon surrounded by question marks
function bigQuestion(ctx, { t, labels, data }) {
  const top = str(data.text || labels?.[0]);
  const bottom = str(data.caption || labels?.[1]);
  const pulse = 1 + Math.sin(t * 2.4) * 0.025;
  ctx.save(); ctx.translate(490, 390); ctx.scale(pulse, pulse);
  ctx.beginPath(); ctx.arc(0, 0, 250, 0, Math.PI * 2); ctx.fillStyle = WHITE; ctx.fill(); stroke(ctx, 6);
  ctx.setLineDash([2, 18]); ctx.beginPath(); ctx.arc(0, 0, 282, 0, Math.PI * 2); stroke(ctx, 6, '#B9B29C'); ctx.setLineDash([]);
  ctx.restore();
  const k = at(t, 0.1, 0.7);
  pop(ctx, k, 490, 390 + Math.sin(t * 2) * 8, () => drawIcon(ctx, data.icon || 'question', 0, 0, 330, t));
  floating(ctx, '?', 150, 190, 110, RED, t, 0);
  floating(ctx, '?', 840, 230, 130, BLUE, t, 1.3);
  floating(ctx, '?', 820, 600, 100, GREEN, t, 2.1);
  floating(ctx, '?', 170, 590, 120, GOLD, t, 3.2);
  pill(ctx, top, 490, 62, RED, t, 0.2, 40);
  pill(ctx, bottom, 490, 740, BLUE, t, 0.8, 36);
}

// ---------------------------------------------------------------- one big number
function bigNumber(ctx, { t, labels, data }) {
  const value = str(data.value || labels?.[0] || '?');
  const caption = str(data.caption || labels?.[1]);
  const note = str(data.note || labels?.[2]);
  const k = at(t, 0.25, 0.7);
  box(ctx, 80, 190, 820, 400, WHITE, 36, 6);
  pop(ctx, k, 490, 350, () => {
    fitText(ctx, value, 0, 0, { size: 200, min: 70, maxWidth: 740, color: RED, weight: 900 });
  });
  if (caption) pop(ctx, at(t, 0.9), 490, 500, () => paragraph(ctx, caption, 0, 0, { maxWidth: 740, size: 52, min: 30, maxLines: 2, color: INK }));
  pop(ctx, at(t, 0.1, 0.8), 150, 170, () => drawIcon(ctx, data.icon || 'coins', 0, 0, 170, t));
  sparkle(ctx, 830, 190, 34 * (0.85 + 0.15 * Math.sin(t * 3)));
  sparkle(ctx, 880, 640, 26 * (0.85 + 0.15 * Math.sin(t * 3 + 1.4)));
  sparkle(ctx, 110, 650, 22 * (0.85 + 0.15 * Math.sin(t * 3 + 2.6)));
  if (note) pill(ctx, note, 490, 690, BLUE, t, 1.5, 38);
}

// ---------------------------------------------------------------- A op B = C
function formula(ctx, { t, data }) {
  const items = arr(data.items).slice(0, 3);
  const ops = arr(data.ops);
  const result = data.result || {};
  const count = items.length + 1;
  const cardH = count > 3 ? 122 : 150;
  const gap = count > 3 ? 46 : 62;
  const total = count * cardH + (count - 1) * gap;
  let y = (H - total) / 2;
  items.forEach((item, i) => {
    const start = 0.3 + i * 1.0;
    const k = at(t, start);
    pop(ctx, k, 490, y + cardH / 2, () => {
      box(ctx, -400, -cardH / 2, 800, cardH, WHITE, 26, 6);
      let textX = 0; let textWidth = 700;
      if (item.icon) { drawIcon(ctx, item.icon, -300, 0, cardH * 0.72, t); textX = 50; textWidth = 560; }
      const main = paragraph(ctx, str(item.text), textX, item.sub ? -16 : 0, { maxWidth: textWidth, size: 56, min: 28, maxLines: 2, color: INK, weight: 900 });
      if (item.sub) fitText(ctx, str(item.sub), textX, main.size * 0.62 + 12, { size: 32, min: 20, maxWidth: textWidth, color: '#5B5A52', weight: 700 });
    });
    y += cardH;
    const op = str(ops[i] || (i === items.length - 1 ? '=' : '×'));
    pop(ctx, at(t, start + 0.55), 490, y + gap / 2, () => {
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fillStyle = GOLD; ctx.fill(); stroke(ctx, 5);
      text(ctx, op, 0, 3, { size: 44, color: INK, weight: 900 });
    });
    y += gap;
  });
  const start = 0.3 + items.length * 1.0 + 0.2;
  pop(ctx, at(t, start, 0.7), 490, y + cardH / 2, () => {
    box(ctx, -400, -cardH / 2, 800, cardH, GREEN, 26, 6);
    const main = paragraph(ctx, str(result.text), 0, result.sub ? -16 : 0, { maxWidth: 720, size: 66, min: 30, maxLines: 2, color: WHITE, weight: 900 });
    if (result.sub) fitText(ctx, str(result.sub), 0, main.size * 0.62 + 12, { size: 32, min: 20, maxWidth: 720, color: '#E6F3EC', weight: 700 });
  });
  if (t > start + 0.4) {
    const wobble = 0.85 + 0.15 * Math.sin(t * 3);
    sparkle(ctx, 70, y + 10, 30 * wobble); sparkle(ctx, 910, y + cardH - 10, 36 * wobble);
  }
}

// ---------------------------------------------------------------- numbered steps
function steps(ctx, { t, data }) {
  const list = arr(data.steps).slice(0, 4);
  const rowH = Math.min(190, 700 / Math.max(1, list.length));
  const top = (H - rowH * list.length) / 2;
  list.forEach((step, i) => {
    const cy = top + rowH * i + rowH / 2;
    if (i < list.length - 1) {
      const lineK = ease((t - (0.6 + i * 1.1)) / 0.5);
      if (lineK > 0) { ctx.save(); ctx.setLineDash([2, 14]); ctx.beginPath(); ctx.moveTo(110, cy + 46); ctx.lineTo(110, cy + 46 + (rowH - 92) * lineK); stroke(ctx, 7, '#8E8873'); ctx.restore(); }
    }
    popAbs(ctx, at(t, 0.3 + i * 1.1), 490, cy, () => {
      const color = ACCENTS[i % ACCENTS.length];
      ctx.beginPath(); ctx.arc(110, cy, 46, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); stroke(ctx, 6);
      text(ctx, String(i + 1), 110, cy + 3, { size: 58, color: WHITE, weight: 900 });
      const h = Math.min(150, rowH - 18);
      box(ctx, 190, cy - h / 2, 750, h, WHITE, 24, 6);
      const main = paragraph(ctx, str(step.text), 565, step.sub ? cy - 18 : cy, { maxWidth: 690, size: 46, min: 26, maxLines: 2, color: INK, weight: 900 });
      if (step.sub) fitText(ctx, str(step.sub), 565, cy + main.size * 0.55 + 14, { size: 30, min: 18, maxWidth: 690, color: '#5B5A52', weight: 700 });
    });
  });
}

// ---------------------------------------------------------------- timeline: label on the left, event on the right
function timeline(ctx, { t, data }) {
  const list = arr(data.items).slice(0, 5);
  const rowH = Math.min(150, 700 / Math.max(1, list.length));
  const top = (H - rowH * list.length) / 2;
  const lineK = ease(t / (0.6 + list.length * 0.8));
  ctx.beginPath(); ctx.moveTo(250, top + 20); ctx.lineTo(250, top + 20 + (rowH * list.length - 40) * lineK); stroke(ctx, 8, '#8E8873');
  list.forEach((item, i) => {
    const cy = top + rowH * i + rowH / 2;
    popAbs(ctx, at(t, 0.3 + i * 0.8), 490, cy, () => {
      const color = ACCENTS[i % ACCENTS.length];
      pill(ctx, str(item.label), 120, cy, color, 99, 0, 34);
      ctx.beginPath(); ctx.arc(250, cy, 18, 0, Math.PI * 2); ctx.fillStyle = GOLD; ctx.fill(); stroke(ctx, 6);
      const h = Math.min(118, rowH - 14);
      box(ctx, 300, cy - h / 2, 640, h, WHITE, 22, 5);
      paragraph(ctx, str(item.text), 620, cy, { maxWidth: 580, size: 38, min: 24, maxLines: 2, color: INK, weight: 800 });
    });
  });
}

// ---------------------------------------------------------------- horizontal bar chart
function barChart(ctx, { t, data }) {
  const list = arr(data.items).slice(0, 5);
  const max = Math.max(...list.map(item => Number(item.value) || 0), 1);
  const rowH = Math.min(140, 640 / Math.max(1, list.length));
  const top = (H - rowH * list.length) / 2 + 10;
  const barX = 290; const barMax = 470;
  if (data.title) pill(ctx, str(data.title), 490, 46, GOLD, t, 0.1, 30);
  list.forEach((item, i) => {
    const cy = top + rowH * i + rowH / 2;
    const start = 0.4 + i * 0.9;
    popAbs(ctx, at(t, start - 0.2), 150, cy, () => {
      box(ctx, 40, cy - 34, 220, 68, WHITE, 18, 5);
      fitText(ctx, str(item.label), 150, cy + 2, { size: 36, min: 20, maxWidth: 190, color: INK, weight: 900 });
    });
    const grow = ease((t - start) / 1.0);
    if (grow > 0) {
      const length = Math.max(24, barMax * ((Number(item.value) || 0) / max) * grow);
      const color = ACCENTS[i % ACCENTS.length];
      roundRect(ctx, barX, cy - 30, length, 60, 16); ctx.fillStyle = color; ctx.fill(); stroke(ctx, 5);
      if (grow > 0.8) text(ctx, str(item.text || item.value), barX + length + 16, cy + 2, { size: 40, color: INK, align: 'left', weight: 900 });
    }
  });
  if (data.note) pill(ctx, str(data.note), 490, 752, BLUE, t, 0.2 + list.length * 0.9, 28);
}

// ---------------------------------------------------------------- two options side by side
function compare(ctx, { t, data }) {
  const sides = [data.left || {}, data.right || {}];
  sides.forEach((side, index) => {
    const x = index ? 505 : 40;
    const start = 0.3 + index * 0.9;
    const color = index ? BLUE : RED;
    pop(ctx, at(t, start, 0.55), x + 217, 400, () => {
      ctx.translate(-(x + 217), -400);
      box(ctx, x, 60, 435, 680, WHITE, 30, 6);
      roundRect(ctx, x + 22, 82, 391, 78, 20); ctx.fillStyle = color; ctx.fill(); stroke(ctx, 5);
      fitText(ctx, str(side.title), x + 217, 123, { size: 42, min: 22, maxWidth: 360, color: WHITE, weight: 900 });
      drawIcon(ctx, side.icon || 'star', x + 217, 285, 190, t);
    });
    arr(side.points).slice(0, 3).forEach((point, i) => {
      pop(ctx, at(t, start + 0.5 + i * 0.4), x + 217, 500 + i * 100, () => {
        ctx.beginPath(); ctx.arc(-170, 0, 14, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); stroke(ctx, 4);
        paragraph(ctx, str(point), -138, 0, { maxWidth: 320, size: 40, min: 24, maxLines: 2, color: INK, weight: 800, align: 'left' });
      });
    });
  });
  pop(ctx, at(t, 0.9, 0.5), 490, 400, () => {
    ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.fillStyle = GOLD; ctx.fill(); stroke(ctx, 6);
    text(ctx, 'VS', 0, 3, { size: 40, color: INK, weight: 900 });
  });
}

// ---------------------------------------------------------------- 2-4 key points with icons
function listPoints(ctx, { t, data }) {
  const list = arr(data.items).slice(0, 4);
  const rowH = Math.min(180, 720 / Math.max(1, list.length));
  const top = (H - rowH * list.length) / 2;
  list.forEach((item, i) => {
    const cy = top + rowH * i + rowH / 2;
    popAbs(ctx, at(t, 0.3 + i * 0.9), 490, cy, () => {
      const h = Math.min(150, rowH - 20);
      box(ctx, 60, cy - h / 2, 860, h, WHITE, 28, 6);
      ctx.beginPath(); ctx.arc(150, cy, h / 2 - 10, 0, Math.PI * 2); ctx.fillStyle = ACCENTS[i % ACCENTS.length]; ctx.fill(); stroke(ctx, 5);
      drawIcon(ctx, item.icon || 'star', 150, cy, h * 0.58, t);
      paragraph(ctx, str(item.text), 540, cy, { maxWidth: 640, size: 44, min: 26, maxLines: 2, color: INK, weight: 900 });
    });
  });
}

// ---------------------------------------------------------------- donut: how much of the whole
function percent(ctx, { t, data }) {
  const value = Math.min(100, Math.max(0, Number(data.percent) || 0));
  const sweep = ease(t / 1.6) * (value / 100) * Math.PI * 2;
  const cx = 490; const cy = 320; const r = 185;
  const ring = (from, to, color) => {
    ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.arc(cx, cy, r, from, to); ctx.lineWidth = 86; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r, from, to); ctx.lineWidth = 72; ctx.strokeStyle = color; ctx.stroke();
  };
  const start = -Math.PI / 2;
  ring(start, start + Math.PI * 2 - 0.0001, BLUE);
  if (sweep > 0.01) ring(start, start + sweep, GOLD);
  ctx.beginPath(); ctx.arc(cx, cy, r + 43, 0, Math.PI * 2); stroke(ctx, 5);
  ctx.beginPath(); ctx.arc(cx, cy, r - 43, 0, Math.PI * 2); stroke(ctx, 5);
  pop(ctx, at(t, 0.5, 0.7), cx, cy - 6, () => fitText(ctx, `${value % 1 ? value.toFixed(1).replace('.', ',') : value}%`, 0, 0, { size: 120, min: 60, maxWidth: 230, color: RED, weight: 900 }));
  if (data.caption) pop(ctx, at(t, 1.0), cx, cy + 70, () => fitText(ctx, str(data.caption), 0, 0, { size: 32, min: 20, maxWidth: 220, color: INK, weight: 800 }));
  const legend = [[GOLD, str(data.label || 'Phần này'), `${value}%`], [BLUE, str(data.restLabel || 'Phần còn lại'), `${100 - value}%`]];
  legend.forEach(([color, label, share], i) => {
    popAbs(ctx, at(t, 1.2 + i * 0.4), 270 + i * 440, 665, () => {
      const x = 60 + i * 440;
      box(ctx, x, 600, 420, 130, WHITE, 24, 5);
      roundRect(ctx, x + 22, 640, 50, 50, 10); ctx.fillStyle = color; ctx.fill(); stroke(ctx, 4);
      fitText(ctx, label, x + 250, 650, { size: 34, min: 20, maxWidth: 300, color: INK, weight: 900 });
      fitText(ctx, share, x + 250, 696, { size: 44, min: 26, maxWidth: 300, color: color === GOLD ? '#B98A1E' : BLUE, weight: 900 });
    });
  });
}

// ---------------------------------------------------------------- one big icon with call-outs
function iconScene(ctx, { t, data }) {
  const k = at(t, 0.1, 0.7);
  ctx.beginPath(); ctx.arc(490, 400, 235, 0, Math.PI * 2); ctx.fillStyle = WHITE; ctx.fill(); stroke(ctx, 6);
  pop(ctx, k, 490, 400 + Math.sin(t * 2) * 8, () => drawIcon(ctx, data.icon || 'star', 0, 0, 330, t));
  const spots = [[190, 100], [790, 160], [490, 722]];
  arr(data.callouts).slice(0, 3).forEach((label, i) => {
    ctx.font = '900 38px Arial, Helvetica, sans-serif';
    const width = Math.min(400, Math.max(180, ctx.measureText(str(label)).width + 60));
    const lines = str(label).length > 18 ? 2 : 1;
    const height = lines === 2 ? 112 : 80;
    // keep the card inside the panel whatever its width
    const x = Math.min(W - 30 - width / 2, Math.max(30 + width / 2, spots[i][0]));
    const y = spots[i][1];
    const from = i === 2 ? [490, y - height / 2] : [x < 490 ? x + width / 2 - 30 : x - width / 2 + 30, y + height / 2];
    const to = i === 2 ? [490, 640] : [x < 490 ? 340 : 640, 250];
    if (t > 0.6 + i * 0.7) dotted(ctx, from, to);
    pop(ctx, at(t, 0.5 + i * 0.7), x, y, () => {
      box(ctx, -width / 2, -height / 2, width, height, WHITE, 20, 5);
      paragraph(ctx, str(label), 0, 0, { maxWidth: width - 36, size: 38, min: 24, maxLines: 2, color: ACCENTS[i % ACCENTS.length], weight: 900 });
    });
  });
}

// ---------------------------------------------------------------- caution / disclaimer notes
function note(ctx, { t, labels, data }) {
  pop(ctx, at(t, 0.1, 0.7), 490, 130, () => drawIcon(ctx, data.icon || 'warning', 0, 0, 190, t));
  pill(ctx, str(data.title || labels?.[0] || 'LƯU Ý'), 490, 270, RED, t, 0.4, 42);
  const list = arr(data.items).slice(0, 3);
  const rowH = Math.min(140, 400 / Math.max(1, list.length));
  list.forEach((item, i) => {
    const cy = 345 + rowH * i + rowH / 2;
    popAbs(ctx, at(t, 0.8 + i * 0.8), 490, cy, () => {
      const h = rowH - 18;
      box(ctx, 60, cy - h / 2, 860, h, WHITE, 24, 5);
      ctx.beginPath(); ctx.arc(120, cy, 17, 0, Math.PI * 2); ctx.fillStyle = ACCENTS[i % ACCENTS.length]; ctx.fill(); stroke(ctx, 4);
      paragraph(ctx, str(item), 535, cy, { maxWidth: 740, size: 38, min: 24, maxLines: 2, color: INK, weight: 800 });
    });
  });
}

// ---------------------------------------------------------------- call to action
function outroGeneric(ctx, { t, labels }) {
  const names = [str(labels?.[0] || 'ĐĂNG KÝ KÊNH'), str(labels?.[1] || 'THẢ TIM'), str(labels?.[2] || 'BÌNH LUẬN')];
  const icons = ['bell', 'heart', 'chat'];
  const colors = [RED, GREEN, BLUE];
  names.forEach((name, i) => {
    const cy = 150 + i * 215;
    pop(ctx, at(t, 0.3 + i * 0.7, 0.6), 490, cy, () => {
      roundRect(ctx, -400, -90, 800, 180, 36); ctx.fillStyle = colors[i]; ctx.fill(); stroke(ctx, 6);
      ctx.beginPath(); ctx.arc(-290, 0, 66, 0, Math.PI * 2); ctx.fillStyle = WHITE; ctx.fill(); stroke(ctx, 5);
      drawIcon(ctx, icons[i], -290, 0, 100, t);
      fitText(ctx, name, 65, 4, { size: 58, min: 26, maxWidth: 470, color: WHITE, weight: 900 });
    });
  });
  for (const [x, y, r, p] of [[60, 60, 30, 0], [920, 90, 36, 1.2], [60, 740, 26, 2], [925, 735, 30, 3]]) sparkle(ctx, x, y, r * (0.85 + 0.15 * Math.sin(t * 3 + p)));
}

export const GENERIC_TEMPLATES = {
  big_question: (ctx, args) => bigQuestion(ctx, { ...args, data: args.data || {} }),
  big_number: (ctx, args) => bigNumber(ctx, { ...args, data: args.data || {} }),
  formula: (ctx, args) => formula(ctx, { ...args, data: args.data || {} }),
  steps: (ctx, args) => steps(ctx, { ...args, data: args.data || {} }),
  timeline: (ctx, args) => timeline(ctx, { ...args, data: args.data || {} }),
  bar_chart: (ctx, args) => barChart(ctx, { ...args, data: args.data || {} }),
  compare: (ctx, args) => compare(ctx, { ...args, data: args.data || {} }),
  list_points: (ctx, args) => listPoints(ctx, { ...args, data: args.data || {} }),
  percent: (ctx, args) => percent(ctx, { ...args, data: args.data || {} }),
  icon_scene: (ctx, args) => iconScene(ctx, { ...args, data: args.data || {} }),
  note: (ctx, args) => note(ctx, { ...args, data: args.data || {} }),
  outro_generic: (ctx, args) => outroGeneric(ctx, { ...args, data: args.data || {} })
};

export { clamp01, PANEL };
