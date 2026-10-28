// Flat-infographic illustrations drawn with the 2D canvas API, one function per storyboard template.
// Every function is a pure function of (ctx, size, time): Remotion calls it again for each frame, so
// the animation depends only on the frame number and renders identically every time.
import {
  INK, PAPER, PANEL, RED, GREEN, BLUE, WATER, WATER_DEEP, ICE, ICE_SHADE, GOLD, WHITE,
  clamp01, ease, back, seeded, roundRect, stroke, text, pill, card, sparkle
} from './canvas-kit.js';
import { GENERIC_TEMPLATES } from './canvas-generic.js';

export { INK, PAPER, PANEL };

function snowflake(ctx, x, y, r, color = ICE_SHADE) {
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < 3; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
    ctx.moveTo(r * 0.55, -r * 0.22); ctx.lineTo(r * 0.8, 0); ctx.lineTo(r * 0.55, r * 0.22);
    ctx.moveTo(-r * 0.55, -r * 0.22); ctx.lineTo(-r * 0.8, 0); ctx.lineTo(-r * 0.55, r * 0.22);
    stroke(ctx, 6, color);
  }
  ctx.restore();
}

function ground(ctx, w, h, y) {
  ctx.fillStyle = '#D8D2C2';
  ctx.fillRect(0, y, w, h - y);
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); stroke(ctx, 6);
}

function iceCube(ctx, x, y, size, angle, tint = null, level = null) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  roundRect(ctx, -size / 2, -size / 2, size, size, size * 0.16);
  ctx.fillStyle = ICE;
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (tint && level !== null) {
    ctx.rotate(-angle);
    ctx.fillStyle = tint;
    ctx.fillRect(-size, level - y, size * 2, size * 2);
    ctx.rotate(angle);
  }
  ctx.restore();
  roundRect(ctx, -size / 2, -size / 2, size, size, size * 0.16);
  stroke(ctx, 5);
  ctx.beginPath();
  ctx.moveTo(-size * 0.3, -size * 0.28); ctx.lineTo(size * 0.05, -size * 0.28);
  ctx.moveTo(-size * 0.3, -size * 0.14); ctx.lineTo(-size * 0.12, -size * 0.14);
  stroke(ctx, 6, '#FFFFFF');
  ctx.restore();
}

function molecule(ctx, x, y, scale, rotation) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  for (const side of [-1, 1]) {
    const hx = side * 36;
    const hy = 26;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(hx, hy); stroke(ctx, 5);
    ctx.beginPath(); ctx.arc(hx, hy, 14, 0, Math.PI * 2);
    ctx.fillStyle = WHITE; ctx.fill(); stroke(ctx, 4);
  }
  ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fillStyle = '#D9625B'; ctx.fill(); stroke(ctx, 5);
  ctx.restore();
}

// ---------------------------------------------------------------- 1. glass of water with ice
function glassOutline(ctx) {
  ctx.beginPath();
  ctx.moveTo(270, 200); ctx.lineTo(710, 200); ctx.lineTo(650, 640); ctx.lineTo(330, 640); ctx.closePath();
}
const glassLeft = y => 270 + (60 * (y - 200)) / 440;
const glassRight = y => 710 - (60 * (y - 200)) / 440;

function glassWithIce(ctx, { t, labels }) {
  ground(ctx, 980, 800, 640);
  ctx.beginPath(); ctx.ellipse(490, 650, 230, 26, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(36,37,34,0.14)'; ctx.fill();

  const surface = x => 282 + Math.sin(x / 55 + t * 2.4) * 5;
  ctx.save();
  glassOutline(ctx); ctx.clip();
  const gradient = ctx.createLinearGradient(0, 270, 0, 640);
  gradient.addColorStop(0, WATER); gradient.addColorStop(1, WATER_DEEP);
  ctx.beginPath(); ctx.moveTo(250, 640);
  for (let x = 250; x <= 730; x += 10) ctx.lineTo(x, surface(x));
  ctx.lineTo(730, 640); ctx.closePath();
  ctx.fillStyle = gradient; ctx.fill();
  ctx.beginPath();
  for (let x = 250; x <= 730; x += 10) (x === 250 ? ctx.moveTo : ctx.lineTo).call(ctx, x, surface(x));
  stroke(ctx, 5, 'rgba(255,255,255,0.8)');
  // bubbles
  for (let i = 0; i < 12; i++) {
    const life = (t * (0.18 + seeded(i) * 0.2) + seeded(i + 9)) % 1;
    const y = 630 - life * 340;
    const x = 360 + seeded(i + 3) * 260 + Math.sin(t * 2 + i) * 8;
    ctx.beginPath(); ctx.arc(x, y, 6 + seeded(i + 5) * 8, 0, Math.PI * 2);
    stroke(ctx, 3, 'rgba(255,255,255,0.9)');
  }
  ctx.restore();

  const cubes = [[420, 270, 118, 0.0, -0.12], [540, 262, 104, 1.7, 0.1], [630, 276, 92, 3.1, -0.06]];
  cubes.forEach(([x, y, size, phase, angle], i) => {
    const bob = Math.sin(t * 1.5 + phase) * 7;
    iceCube(ctx, x, y + bob, size, angle + Math.sin(t * 1.1 + i) * 0.05, 'rgba(90,155,198,0.42)', surface(x) + 4);
  });

  glassOutline(ctx); stroke(ctx, 9);
  ctx.beginPath(); ctx.moveTo(300, 250); ctx.lineTo(318, 560); stroke(ctx, 12, 'rgba(255,255,255,0.65)');
  for (const [x, y] of [[742, 330], [716, 460], [744, 520]]) {
    ctx.beginPath(); ctx.ellipse(x, y, 8, 13, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill(); stroke(ctx, 3);
  }
  const marks = [[170, 300, 0], [800, 340, 1.4], [150, 470, 2.6]];
  for (const [x, y, phase] of marks) {
    const bob = Math.sin(t * 2 + phase) * 8;
    ctx.beginPath(); ctx.arc(x, y + bob, 36, 0, Math.PI * 2); ctx.fillStyle = WHITE; ctx.fill(); stroke(ctx, 5);
    text(ctx, '?', x, y + bob + 3, { size: 46, color: RED });
  }
  const [left, right] = labels || ['LY NƯỚC ĐÁ', 'ĐÁ NỔI!'];
  pill(ctx, left, 220, 90, RED, t, 0.2);
  pill(ctx, right, 770, 90, GREEN, t, 1.4);
}

// ---------------------------------------------------------------- 2. balance: same volume, different mass
function cube3d(ctx, x, y, size, front, top, side, label) {
  const depth = size * 0.28;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + depth, y - depth); ctx.lineTo(x + size + depth, y - depth); ctx.lineTo(x + size, y); ctx.closePath();
  ctx.fillStyle = top; ctx.fill(); stroke(ctx, 5);
  ctx.beginPath(); ctx.moveTo(x + size, y); ctx.lineTo(x + size + depth, y - depth); ctx.lineTo(x + size + depth, y + size - depth); ctx.lineTo(x + size, y + size); ctx.closePath();
  ctx.fillStyle = side; ctx.fill(); stroke(ctx, 5);
  roundRect(ctx, x, y, size, size, 8); ctx.fillStyle = front; ctx.fill(); stroke(ctx, 5);
  if (label) text(ctx, label, x + size / 2, y + size / 2 + 2, { size: 38, color: INK });
}

function densityBalance(ctx, { t, labels }) {
  const [leftLabel, rightLabel] = labels || ['NƯỚC LỎNG', 'NƯỚC ĐÁ'];
  pill(ctx, 'CÙNG THỂ TÍCH', 490, 52, GOLD, t, 0.1, 30);
  const settle = ease(t / 1.3);
  const tilt = -0.15 * settle + Math.sin(t * 5) * 0.025 * Math.exp(-t * 1.6) * (t > 0.8 ? 1 : 0);
  const pivot = { x: 490, y: 250 };
  // stand
  ctx.beginPath(); ctx.moveTo(400, 770); ctx.lineTo(580, 770); ctx.lineTo(540, 720); ctx.lineTo(440, 720); ctx.closePath();
  ctx.fillStyle = '#C9B488'; ctx.fill(); stroke(ctx, 6);
  roundRect(ctx, 474, 250, 32, 480, 10); ctx.fillStyle = '#C9B488'; ctx.fill(); stroke(ctx, 6);
  const end = side => ({ x: pivot.x + side * 330 * Math.cos(tilt), y: pivot.y + side * 330 * Math.sin(tilt) });
  const a = end(-1); const b = end(1);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); stroke(ctx, 18);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); stroke(ctx, 8, GOLD);
  ctx.beginPath(); ctx.arc(pivot.x, pivot.y, 20, 0, Math.PI * 2); ctx.fillStyle = GOLD; ctx.fill(); stroke(ctx, 6);

  const pan = (p, front, topColor, sideColor, label, tag, tagColor, valueColor, name, nameColor, appear) => {
    const panY = p.y + 190;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 120, panY); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 120, panY); stroke(ctx, 4);
    cube3d(ctx, p.x - 62, panY - 130, 124, front, topColor, sideColor, label);
    ctx.beginPath(); ctx.moveTo(p.x - 150, panY); ctx.quadraticCurveTo(p.x, panY + 70, p.x + 150, panY); ctx.closePath();
    ctx.fillStyle = '#C9B488'; ctx.fill(); stroke(ctx, 6);
    card(ctx, tag, p.x, 650, valueColor, t, appear, 38, 230);
    pill(ctx, name, p.x, 580, nameColor, t, appear - 0.2, 28);
  };
  pan(a, WATER, '#B5DBEE', '#6FAED3', 'H₂O', '1,00 g/cm³', null, RED, leftLabel, BLUE, 1.2);
  pan(b, ICE, '#F6FDFF', ICE_SHADE, '', '0,92 g/cm³', null, GREEN, rightLabel, GREEN, 1.7);
  if (t > 2.2) {
    const k = ease((t - 2.2) / 0.5);
    ctx.globalAlpha = k;
    text(ctx, 'NHẸ HƠN  →  NỔI', 490, 120 - (1 - k) * 12, { size: 40, color: INK });
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- 3. molecules: liquid vs ice lattice
function moleculesScene(ctx, { t, labels }) {
  const [leftLabel, rightLabel] = labels || ['NƯỚC LỎNG', 'NƯỚC ĐÁ'];
  const panels = [[30, 130, 440, 590, '#DCEAF3'], [510, 130, 440, 590, '#EAF7FB']];
  for (const [x, y, w, h, color] of panels) { roundRect(ctx, x, y, w, h, 28); ctx.fillStyle = color; ctx.fill(); stroke(ctx, 5); }
  pill(ctx, leftLabel, 250, 100, BLUE, t, 0.1);
  pill(ctx, rightLabel, 730, 100, GREEN, t, 0.7);

  // liquid: crowded molecules sliding past each other
  ctx.save(); roundRect(ctx, 30, 130, 440, 590, 28); ctx.clip();
  const spots = [];
  for (let i = 0; i < 60 && spots.length < 15; i++) {
    const x = 85 + seeded(i * 2 + 1) * 330;
    const y = 190 + seeded(i * 2 + 2) * 470;
    if (spots.every(([sx, sy]) => Math.hypot(sx - x, sy - y) > 92)) spots.push([x, y]);
  }
  spots.forEach(([x, y], i) => {
    molecule(ctx, x + Math.sin(t * 1.8 + i * 1.7) * 16, y + Math.cos(t * 1.5 + i * 2.3) * 16, 0.95, Math.sin(t * 1.2 + i) * 0.9 + i);
  });
  ctx.restore();

  // ice: open hexagonal lattice
  ctx.save(); roundRect(ctx, 510, 130, 440, 590, 28); ctx.clip();
  const L = 64;
  const cx = 730; const cy = 425;
  const centers = [[0, 0]];
  for (let k = 0; k < 6; k++) centers.push([Math.cos((k * Math.PI) / 3) * L * Math.sqrt(3), Math.sin((k * Math.PI) / 3) * L * Math.sqrt(3)]);
  for (let k = 0; k < 6; k++) centers.push([Math.cos((k * Math.PI) / 3 + Math.PI / 6) * L * 3, Math.sin((k * Math.PI) / 3 + Math.PI / 6) * L * 3]);
  const breathe = 1 + Math.sin(t * 1.4) * 0.012;
  const vertices = new Map();
  centers.forEach(([hx, hy]) => {
    const points = [0, 1, 2, 3, 4, 5].map(k => [cx + (hx + Math.cos((k * Math.PI) / 3 + Math.PI / 6) * L) * breathe, cy + (hy + Math.sin((k * Math.PI) / 3 + Math.PI / 6) * L) * breathe]);
    ctx.beginPath(); points.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill(); stroke(ctx, 4);
    points.forEach(([px, py]) => vertices.set(`${Math.round(px)}:${Math.round(py)}`, [px, py]));
  });
  vertices.forEach(([px, py]) => {
    ctx.beginPath(); ctx.arc(px, py, 14, 0, Math.PI * 2); ctx.fillStyle = '#D9625B'; ctx.fill(); stroke(ctx, 4);
  });
  ctx.restore();
  if (t > 1.6) {
    const k = ease((t - 1.6) / 0.5);
    ctx.globalAlpha = k;
    ctx.beginPath(); ctx.moveTo(840, 640); ctx.quadraticCurveTo(790, 600, cx + 40, cy + 20); stroke(ctx, 5, RED);
    ctx.beginPath(); ctx.arc(cx + 40, cy + 20, 7, 0, Math.PI * 2); ctx.fillStyle = RED; ctx.fill();
    ctx.globalAlpha = 1;
    card(ctx, 'KHOẢNG TRỐNG', 790, 668, RED, t, 1.6, 28, 0);
  }
  text(ctx, 'Xếp sát, trượt lên nhau', 250, 748, { size: 30, color: INK });
  text(ctx, 'Mạng lục giác rỗng', 730, 748, { size: 30, color: INK });
}

// ---------------------------------------------------------------- 4. freezing makes 9% more volume
function beaker(ctx, x, fill, topY, color, edge) {
  const left = x - 120; const right = x + 120; const top = 150; const bottom = 640;
  ctx.save();
  ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left, bottom - 24); ctx.arcTo(left, bottom, left + 24, bottom, 24); ctx.lineTo(right - 24, bottom); ctx.arcTo(right, bottom, right, bottom - 24, 24); ctx.lineTo(right, top);
  ctx.clip();
  ctx.fillStyle = color; ctx.fillRect(left, topY, 240, bottom - topY);
  ctx.beginPath(); ctx.moveTo(left, topY); ctx.lineTo(right, topY); stroke(ctx, 5, edge);
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left, bottom - 24); ctx.arcTo(left, bottom, left + 24, bottom, 24); ctx.lineTo(right - 24, bottom); ctx.arcTo(right, bottom, right, bottom - 24, 24); ctx.lineTo(right, top);
  stroke(ctx, 8);
  for (let i = 1; i < 10; i++) { ctx.beginPath(); ctx.moveTo(right, bottom - i * 49); ctx.lineTo(right - (i % 2 ? 26 : 44), bottom - i * 49); stroke(ctx, 4); }
  return fill;
}

function volumeExpansion(ctx, { t, labels }) {
  const [beforeLabel, afterLabel] = labels || ['TRƯỚC', 'SAU'];
  const base = 640 - 0.6 * 490;
  const freeze = ease((t - 0.9) / 1.4);
  const risen = base - 0.6 * 490 * 0.09 * freeze;
  pill(ctx, beforeLabel, 250, 80, BLUE, t, 0.1);
  pill(ctx, afterLabel, 730, 80, GREEN, t, 0.5);
  beaker(ctx, 250, 0, base, WATER, 'rgba(255,255,255,0.8)');
  const color = freeze > 0.5 ? ICE_SHADE : WATER;
  beaker(ctx, 730, 0, risen, color, 'rgba(255,255,255,0.9)');
  if (freeze > 0.1) for (let i = 0; i < 5; i++) { ctx.globalAlpha = freeze; snowflake(ctx, 660 + i * 38, 470 + ((i * 53) % 110), 14, '#FFFFFF'); ctx.globalAlpha = 1; }
  // old level reference
  ctx.save(); ctx.setLineDash([14, 12]);
  ctx.beginPath(); ctx.moveTo(130, base); ctx.lineTo(850, base); stroke(ctx, 4, RED); ctx.restore();
  // freezing arrow
  ctx.beginPath(); ctx.moveTo(400, 400); ctx.lineTo(560, 400); stroke(ctx, 10);
  ctx.beginPath(); ctx.moveTo(540, 366); ctx.lineTo(580, 400); ctx.lineTo(540, 434); stroke(ctx, 10);
  snowflake(ctx, 480, 330, 28, BLUE);
  if (freeze > 0.9) {
    const k = back((t - 2.2) / 0.5);
    ctx.save(); ctx.translate(880, (base + risen) / 2 - 6); ctx.scale(Math.max(0, k), Math.max(0, k));
    ctx.beginPath(); ctx.moveTo(0, 56); ctx.lineTo(0, -56); stroke(ctx, 8, RED);
    ctx.beginPath(); ctx.moveTo(-18, -34); ctx.lineTo(0, -58); ctx.lineTo(18, -34); stroke(ctx, 8, RED);
    ctx.restore();
    pill(ctx, '+9%', 880, base - 60, RED, t, 2.2, 38);
  }
  card(ctx, 'KHỐI LƯỢNG KHÔNG ĐỔI', 490, 730, INK, t, 2.0, 32);
}

// ---------------------------------------------------------------- 5. iceberg: ~9% above water
function iceberg(ctx, { t, labels }) {
  const [topLabel, bottomLabel] = labels || ['~9% TRÊN MẶT NƯỚC', '~91% DƯỚI NƯỚC'];
  const waterline = 300;
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, waterline);
  sky.addColorStop(0, '#F8F3E4'); sky.addColorStop(1, '#DDEFF6');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 980, waterline);
  ctx.save(); ctx.translate(150, 120);
  for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6 + t * 0.2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 62, Math.sin(a) * 62); ctx.lineTo(Math.cos(a) * 84, Math.sin(a) * 84); stroke(ctx, 6, GOLD); }
  ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.fillStyle = GOLD; ctx.fill(); stroke(ctx, 6); ctx.restore();
  for (const [x, y, s] of [[420, 90, 1], [700, 150, 0.8]]) {
    ctx.save(); ctx.translate(x + Math.sin(t * 0.5 + x) * 14, y); ctx.scale(s, s);
    // Outline first, fill on top: the overlapping puffs merge into one clean silhouette.
    const puffs = () => { ctx.beginPath(); ctx.arc(-34, 8, 28, 0, Math.PI * 2); ctx.moveTo(38, -8); ctx.arc(0, -8, 38, 0, Math.PI * 2); ctx.moveTo(70, 8); ctx.arc(40, 8, 30, 0, Math.PI * 2); ctx.rect(-34, 6, 74, 32); };
    puffs(); stroke(ctx, 12);
    puffs(); ctx.fillStyle = WHITE; ctx.fill();
    ctx.restore();
  }
  // sea
  const sea = ctx.createLinearGradient(0, waterline, 0, 800);
  sea.addColorStop(0, WATER); sea.addColorStop(1, '#3F78A5');
  ctx.fillStyle = sea; ctx.fillRect(0, waterline, 980, 800 - waterline);
  const bob = Math.sin(t * 1.3) * 6;
  ctx.save(); ctx.translate(-70, bob);
  const under = [[345, waterline], [300, 400], [330, 510], [420, 610], [520, 660], [630, 605], [690, 500], [670, 395], [625, waterline]];
  ctx.beginPath(); under.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  ctx.fillStyle = 'rgba(232,248,253,0.62)'; ctx.fill(); stroke(ctx, 5, 'rgba(36,37,34,0.7)');
  ctx.beginPath(); ctx.moveTo(420, 610); ctx.lineTo(470, 420); ctx.lineTo(560, 640); ctx.moveTo(330, 510); ctx.lineTo(470, 420); ctx.lineTo(690, 500);
  stroke(ctx, 3, 'rgba(36,37,34,0.35)');
  const top = [[345, waterline], [405, 245], [455, 205], [505, 238], [548, 218], [625, waterline]];
  ctx.beginPath(); top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  ctx.fillStyle = WHITE; ctx.fill(); stroke(ctx, 6);
  ctx.beginPath(); ctx.moveTo(455, 205); ctx.lineTo(480, 262); ctx.lineTo(548, 218); ctx.lineTo(548, 300); ctx.lineTo(480, 300); ctx.closePath();
  ctx.fillStyle = ICE_SHADE; ctx.fill(); stroke(ctx, 4);
  ctx.restore();
  // waves over the waterline
  ctx.beginPath(); for (let x = 0; x <= 980; x += 10) (x ? ctx.lineTo : ctx.moveTo).call(ctx, x, waterline + Math.sin(x / 40 + t * 2.4) * 5);
  stroke(ctx, 6, 'rgba(255,255,255,0.9)');
  // brackets
  const bracket = (y1, y2, color, appear) => {
    ctx.globalAlpha = ease((t - appear) / 0.5);
    ctx.beginPath(); ctx.moveTo(668, y1); ctx.lineTo(692, y1); ctx.lineTo(692, y2); ctx.lineTo(668, y2); stroke(ctx, 6, color);
    ctx.globalAlpha = 1;
  };
  bracket(205, waterline - 4, GREEN, 1.2);
  pill(ctx, topLabel, 838, 252, GREEN, t, 1.2, 21);
  bracket(waterline + 6, 665, RED, 2.0);
  pill(ctx, bottomLabel, 838, 485, RED, t, 2.0, 21);
  // gull
  ctx.beginPath(); ctx.moveTo(560, 110); ctx.quadraticCurveTo(585, 90 + Math.sin(t * 5) * 8, 610, 110); ctx.quadraticCurveTo(635, 90 + Math.sin(t * 5) * 8, 660, 110); stroke(ctx, 5);
}

// ---------------------------------------------------------------- 6. frozen lake keeps fish alive
function fish(ctx, x, y, size, direction, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(direction, 1);
  ctx.beginPath(); ctx.moveTo(-size * 0.9, 0); ctx.lineTo(-size * 1.4, -size * 0.45); ctx.lineTo(-size * 1.4, size * 0.45); ctx.closePath();
  ctx.fillStyle = color; ctx.fill(); stroke(ctx, 4);
  ctx.beginPath(); ctx.ellipse(0, 0, size, size * 0.55, 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); stroke(ctx, 5);
  ctx.beginPath(); ctx.arc(size * 0.5, -size * 0.1, size * 0.11, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
  ctx.beginPath(); ctx.moveTo(-size * 0.1, -size * 0.5); ctx.quadraticCurveTo(size * 0.2, -size * 0.9, size * 0.35, -size * 0.45); stroke(ctx, 4);
  ctx.restore();
}

function frozenLake(ctx, { t, labels }) {
  const [iceLabel, waterLabel] = labels || ['BĂNG 0°C', 'NƯỚC ~4°C'];
  ctx.fillStyle = '#EFEBDD'; ctx.fillRect(0, 0, 980, 120);
  for (let i = 0; i < 16; i++) { const x = (seeded(i) * 980 + t * (20 + seeded(i + 2) * 22)) % 980; const y = (seeded(i + 4) * 120 + t * 38) % 130; ctx.beginPath(); ctx.arc(x, y, 3 + seeded(i + 1) * 3, 0, Math.PI * 2); ctx.fillStyle = WHITE; ctx.fill(); }
  const lake = ctx.createLinearGradient(0, 215, 0, 740);
  lake.addColorStop(0, '#9CCBE5'); lake.addColorStop(1, '#2F6C9A');
  ctx.fillStyle = lake; ctx.fillRect(0, 215, 980, 585);
  // lake bed
  ctx.fillStyle = '#9C8667'; ctx.beginPath(); ctx.moveTo(0, 745); for (let x = 0; x <= 980; x += 70) ctx.lineTo(x, 735 + ((x / 70) % 2) * 18); ctx.lineTo(980, 800); ctx.lineTo(0, 800); ctx.closePath(); ctx.fill(); stroke(ctx, 5);
  for (const [x, h] of [[120, 130], [210, 90], [800, 150], [880, 100]]) { ctx.beginPath(); ctx.moveTo(x, 745); ctx.bezierCurveTo(x + Math.sin(t * 1.5 + x) * 24, 745 - h * 0.4, x - Math.sin(t * 1.5 + x) * 24, 745 - h * 0.7, x + Math.sin(t * 1.7 + x) * 18, 745 - h); stroke(ctx, 9, '#3F8A5C'); }
  // ice sheet
  ctx.beginPath(); ctx.moveTo(0, 105); ctx.lineTo(980, 105); ctx.lineTo(980, 215); for (let x = 980; x >= 0; x -= 70) ctx.lineTo(x, 215 + ((x / 70) % 2) * 20); ctx.closePath();
  ctx.fillStyle = ICE; ctx.fill(); stroke(ctx, 6);
  ctx.beginPath(); ctx.moveTo(180, 130); ctx.lineTo(240, 170); ctx.lineTo(220, 205); ctx.moveTo(620, 125); ctx.lineTo(560, 165); ctx.lineTo(590, 200); stroke(ctx, 4, 'rgba(36,37,34,0.35)');
  ctx.beginPath(); ctx.moveTo(0, 105); ctx.quadraticCurveTo(120, 78, 240, 105); ctx.quadraticCurveTo(360, 80, 480, 105); ctx.quadraticCurveTo(600, 78, 720, 105); ctx.quadraticCurveTo(850, 82, 980, 105); ctx.lineTo(980, 120); ctx.lineTo(0, 120); ctx.closePath(); ctx.fillStyle = WHITE; ctx.fill(); stroke(ctx, 5);
  // fish and bubbles
  const swimmers = [[0.0, 380, 46, '#E58B5A', 1], [0.35, 500, 56, '#E9B949', -1], [0.7, 610, 42, '#D9625B', 1]];
  for (const [phase, y, size, color, dir] of swimmers) {
    const progress = (t * 0.06 + phase) % 1;
    const x = dir > 0 ? -80 + progress * 1140 : 1060 - progress * 1140;
    fish(ctx, x, y + Math.sin(t * 2 + phase * 9) * 12, size, dir, color);
    for (let b = 0; b < 3; b++) { ctx.beginPath(); ctx.arc(x - dir * (size * 1.7 + b * 24), y - 10 - b * 16 + Math.sin(t * 3 + b) * 4, 5 + b * 2, 0, Math.PI * 2); stroke(ctx, 3, 'rgba(255,255,255,0.9)'); }
  }
  // warm water sinks arrows
  for (let i = 0; i < 3; i++) { const x = 330 + i * 160; const y = 260 + ((t * 70 + i * 90) % 200); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 40); ctx.moveTo(x - 14, y + 26); ctx.lineTo(x, y + 44); ctx.lineTo(x + 14, y + 26); stroke(ctx, 5, 'rgba(255,255,255,0.85)'); }
  pill(ctx, iceLabel, 160, 162, GREEN, t, 0.3, 28);
  pill(ctx, waterLabel, 780, 690, RED, t, 1.2, 28);
}

// ---------------------------------------------------------------- 7. outro
function outro(ctx, { t, labels }) {
  const [a, b, c] = labels || ['ĐĂNG KÝ KÊNH', 'THẢ TIM', 'ĐẶT CÂU HỎI'];
  ctx.save(); ctx.translate(490, 50); ctx.scale(0.86, 0.86); ctx.translate(-490, 0);
  glassWithIce(ctx, { t, labels: ['', ''] });
  ctx.restore();
  for (const [x, y, r, p] of [[120, 200, 30, 0], [860, 220, 38, 1.2], [90, 500, 24, 2], [890, 520, 28, 3]]) sparkle(ctx, x, y, r * (0.85 + 0.15 * Math.sin(t * 3 + p)));
  pill(ctx, a, 490, 60, RED, t, 0.2, 40);
  pill(ctx, b, 250, 735, GREEN, t, 0.9, 32);
  pill(ctx, c, 730, 735, BLUE, t, 1.3, 32);
}

export const TEMPLATES = {
  glass_ice: glassWithIce,
  density_balance: densityBalance,
  molecules: moleculesScene,
  volume_expansion: volumeExpansion,
  iceberg,
  frozen_lake: frozenLake,
  outro,
  ...GENERIC_TEMPLATES
};

// `data` carries the per-scene content of the generic templates; the older ice templates only use `labels`.
export function drawTemplate(name, ctx, size, t, labels, data = {}) {
  const draw = TEMPLATES[name];
  if (!draw) throw new Error(`Unknown scene template "${name}"`);
  ctx.save();
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.fillStyle = PANEL; ctx.fillRect(0, 0, size.width, size.height);
  draw(ctx, { t, labels, data });
  ctx.restore();
}

// Exposed for the thumbnail, which reuses the glass-of-water drawing.
export { glassWithIce, iceCube, sparkle, pill, roundRect, stroke, text, RED, GREEN, BLUE, WHITE, GOLD };
export { drawIcon, ICON_NAMES } from './canvas-icons.js';
