// Flat icons drawn with the 2D canvas API. Every icon fits a 100x100 box centred on (0, 0) and is a pure
// function of (ctx, t), so the storyboard can name an icon and the renderer draws it identically each frame.
import { INK, WHITE, GOLD, RED, GREEN, BLUE, WATER, PINK, ORANGE, PURPLE, WOOD, PANEL, stroke, roundRect, text } from './canvas-kit.js';

const LINE = 5;
const GOLD_DARK = '#B98A1E';
const GREY = '#B8B2A0';
const NAVY = '#2F3A45';
const TAU = Math.PI * 2;

const fillStroke = (ctx, fill, width = LINE) => { ctx.fillStyle = fill; ctx.fill(); stroke(ctx, width); };
const circle = (ctx, x, y, r, fill, width = LINE) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); fillStroke(ctx, fill, width); };
const polyline = (ctx, points, width = LINE, color = INK) => {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  stroke(ctx, width, color);
};
const polygon = (ctx, points, fill, width = LINE) => {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  fillStroke(ctx, fill, width);
};
const ellipse = (ctx, x, y, rx, ry, fill, rotation = 0, width = LINE) => {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rotation, 0, TAU); fillStroke(ctx, fill, width);
};

// Outline first, fill on top: gives one clean outline around a union of overlapping circles.
function blob(ctx, circles, fill) {
  ctx.beginPath();
  for (const [x, y, r] of circles) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
  ctx.lineWidth = LINE * 2; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.fillStyle = fill; ctx.fill();
}

function disc(ctx, y, top = GOLD, side = GOLD_DARK) {
  ctx.beginPath(); ctx.ellipse(0, y + 12, 38, 14, 0, 0, TAU); fillStroke(ctx, side);
  ctx.beginPath(); ctx.rect(-38, y, 76, 12); ctx.fillStyle = side; ctx.fill();
  polyline(ctx, [[-38, y], [-38, y + 12]]); polyline(ctx, [[38, y], [38, y + 12]]);
  ctx.beginPath(); ctx.ellipse(0, y, 38, 14, 0, 0, TAU); fillStroke(ctx, top);
}

export const ICONS = {
  coin(ctx) {
    circle(ctx, 0, 0, 40, GOLD);
    ctx.beginPath(); ctx.arc(0, 0, 28, 0, TAU); stroke(ctx, 3, GOLD_DARK);
    roundRect(ctx, -5, -17, 10, 34, 4); ctx.fillStyle = GOLD_DARK; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-13, -9); ctx.lineTo(13, -9); stroke(ctx, 5, GOLD_DARK);
  },
  coins(ctx) { disc(ctx, 20); disc(ctx, 0); disc(ctx, -20); },
  piggy(ctx) {
    polyline(ctx, [[-40, 0], [-50, -8], [-44, -16]], 5);
    polygon(ctx, [[8, -24], [20, -42], [28, -20]], PINK);
    ellipse(ctx, -2, 4, 42, 32, PINK);
    ellipse(ctx, 40, 8, 11, 12, '#E08C86');
    circle(ctx, 36, 8, 1.6, INK, 0); circle(ctx, 45, 8, 1.6, INK, 0);
    polygon(ctx, [[-24, 28], [-10, 28], [-10, 46], [-24, 46]], '#E08C86');
    polygon(ctx, [[12, 28], [26, 28], [26, 46], [12, 46]], '#E08C86');
    circle(ctx, 16, -6, 3.6, INK, 0);
    polyline(ctx, [[-14, -26], [8, -26]], 6);
    circle(ctx, -3, -44, 9, GOLD, 4);
  },
  wallet(ctx) {
    roundRect(ctx, -42, -26, 84, 58, 10); fillStroke(ctx, '#A8604A');
    roundRect(ctx, -42, -26, 84, 20, 10); fillStroke(ctx, '#C27A60');
    roundRect(ctx, 10, -2, 38, 26, 8); fillStroke(ctx, GOLD);
    circle(ctx, 24, 11, 4, INK, 0);
  },
  bulb(ctx, t) {
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.5;
      const reach = 6 + Math.sin(t * 4 + i) * 2;
      polyline(ctx, [[Math.cos(a) * 36, -8 + Math.sin(a) * 36], [Math.cos(a) * (46 + reach), -8 + Math.sin(a) * (46 + reach)]], 4, GOLD_DARK);
    }
    circle(ctx, 0, -8, 28, '#F6D56B');
    polyline(ctx, [[-8, 14], [-8, 0], [0, -8], [8, 0], [8, 14]], 3);
    roundRect(ctx, -14, 18, 28, 14, 4); fillStroke(ctx, GREY);
    roundRect(ctx, -10, 32, 20, 10, 4); fillStroke(ctx, GREY);
  },
  atom(ctx, t) {
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, 0, 44, 16, (i * Math.PI) / 3 + t * 0.4, 0, TAU); stroke(ctx, 4, BLUE); }
    for (let i = 0; i < 3; i++) {
      const a = t * 2 + i * 2.1; const r = (i * Math.PI) / 3 + t * 0.4;
      const x = Math.cos(a) * 44; const y = Math.sin(a) * 16;
      circle(ctx, x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r), 6, GOLD, 3);
    }
    circle(ctx, 0, 0, 11, RED);
  },
  globe(ctx, t) {
    circle(ctx, 0, 0, 40, WATER);
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 38, 0, TAU); ctx.clip();
    const shift = (t * 12) % 80;
    for (const dx of [-80, 0]) {
      ctx.save(); ctx.translate(dx + shift, 0);
      ctx.beginPath(); ctx.moveTo(-26, -14); ctx.quadraticCurveTo(-10, -34, 8, -22); ctx.quadraticCurveTo(2, -6, 14, 2); ctx.quadraticCurveTo(-6, 18, -18, 6); ctx.closePath(); fillStroke(ctx, GREEN, 3);
      ctx.beginPath(); ctx.moveTo(22, 14); ctx.quadraticCurveTo(38, 8, 40, 26); ctx.quadraticCurveTo(28, 38, 18, 28); ctx.closePath(); fillStroke(ctx, GREEN, 3);
      ctx.restore();
    }
    ctx.restore();
    ctx.beginPath(); ctx.arc(0, 0, 40, 0, TAU); stroke(ctx, LINE);
  },
  rocket(ctx, t) {
    const flame = 40 + Math.sin(t * 20) * 5;
    ctx.beginPath(); ctx.moveTo(-9, 24); ctx.lineTo(0, 24 + flame * 0.5); ctx.lineTo(9, 24); ctx.closePath(); fillStroke(ctx, ORANGE);
    polygon(ctx, [[-16, 4], [-34, 30], [-16, 26]], RED);
    polygon(ctx, [[16, 4], [34, 30], [16, 26]], RED);
    ctx.beginPath(); ctx.moveTo(0, -46); ctx.quadraticCurveTo(24, -20, 17, 26); ctx.lineTo(-17, 26); ctx.quadraticCurveTo(-24, -20, 0, -46); ctx.closePath(); fillStroke(ctx, WHITE);
    ctx.beginPath(); ctx.moveTo(0, -46); ctx.quadraticCurveTo(13, -33, 17, -22); ctx.lineTo(-17, -22); ctx.quadraticCurveTo(-13, -33, 0, -46); ctx.closePath(); fillStroke(ctx, RED);
    circle(ctx, 0, -6, 9, BLUE);
  },
  brain(ctx) {
    blob(ctx, [[-20, -6, 20], [0, -18, 20], [20, -6, 20], [-16, 14, 20], [16, 14, 20], [0, 8, 22]], PINK);
    polyline(ctx, [[0, -34], [0, 30]], 3);
    polyline(ctx, [[-30, -4], [-18, -10], [-10, 2]], 3);
    polyline(ctx, [[30, -4], [18, -10], [10, 2]], 3);
    polyline(ctx, [[-24, 20], [-12, 14], [-8, 24]], 3);
    polyline(ctx, [[24, 20], [12, 14], [8, 24]], 3);
  },
  heart(ctx, t) {
    const k = 1 + Math.sin(t * 6) * 0.04;
    ctx.scale(k, k);
    ctx.beginPath(); ctx.moveTo(0, 38); ctx.bezierCurveTo(-56, 2, -34, -44, 0, -16); ctx.bezierCurveTo(34, -44, 56, 2, 0, 38); ctx.closePath(); fillStroke(ctx, RED);
    ctx.beginPath(); ctx.arc(-20, -12, 10, Math.PI * 1.1, Math.PI * 1.6); stroke(ctx, 4, WHITE);
  },
  clock(ctx, t) {
    circle(ctx, -28, -34, 10, RED, 4); circle(ctx, 28, -34, 10, RED, 4);
    circle(ctx, 0, 2, 40, WHITE);
    for (let i = 0; i < 12; i++) { const a = (i * TAU) / 12; polyline(ctx, [[Math.cos(a) * 33, 2 + Math.sin(a) * 33], [Math.cos(a) * 38, 2 + Math.sin(a) * 38]], 3); }
    const minute = t * 1.6 - Math.PI / 2; const hour = t * 0.13 - Math.PI / 2;
    polyline(ctx, [[0, 2], [Math.cos(minute) * 30, 2 + Math.sin(minute) * 30]], 4);
    polyline(ctx, [[0, 2], [Math.cos(hour) * 20, 2 + Math.sin(hour) * 20]], 6);
    circle(ctx, 0, 2, 4, RED, 2);
  },
  chart(ctx, t) {
    polyline(ctx, [[-42, -40], [-42, 40], [44, 40]], 5);
    const grow = Math.min(1, t / 0.8);
    [[-30, 22, GREEN], [-8, 36, GOLD], [14, 52, BLUE]].forEach(([x, h, color]) => {
      roundRect(ctx, x, 40 - h * grow, 18, h * grow, 3); fillStroke(ctx, color, 4);
    });
    polyline(ctx, [[-36, 6], [-6, -8], [10, -4], [38, -32]], 5, RED);
    polygon(ctx, [[42, -38], [26, -32], [38, -20]], RED, 3);
  },
  house(ctx) {
    polygon(ctx, [[-34, -2], [34, -2], [34, 42], [-34, 42]], '#F6E7C1');
    polygon(ctx, [[-46, -2], [0, -42], [46, -2]], RED);
    polygon(ctx, [[22, -30], [34, -30], [34, -12], [22, -20]], GREY, 4);
    roundRect(ctx, -9, 16, 18, 26, 3); fillStroke(ctx, WOOD, 4);
    roundRect(ctx, 14, 8, 14, 14, 2); fillStroke(ctx, WATER, 4);
    roundRect(ctx, -28, 8, 14, 14, 2); fillStroke(ctx, WATER, 4);
  },
  cart(ctx) {
    polyline(ctx, [[-46, -34], [-34, -34], [-24, 14], [30, 14]], 5);
    polygon(ctx, [[-30, -22], [44, -22], [36, 8], [-24, 8]], ORANGE);
    polyline(ctx, [[-12, -22], [-8, 8]], 3); polyline(ctx, [[10, -22], [8, 8]], 3); polyline(ctx, [[28, -22], [22, 8]], 3);
    circle(ctx, -16, 30, 8, GREY); circle(ctx, 24, 30, 8, GREY);
  },
  laptop(ctx) {
    roundRect(ctx, -36, -34, 72, 50, 6); fillStroke(ctx, NAVY);
    roundRect(ctx, -30, -28, 60, 38, 3); ctx.fillStyle = BLUE; ctx.fill();
    polyline(ctx, [[-22, -16], [4, -16]], 4, WHITE); polyline(ctx, [[-22, -8], [14, -8]], 4, WHITE); polyline(ctx, [[-22, 0], [-4, 0]], 4, WHITE);
    polygon(ctx, [[-46, 20], [46, 20], [38, 32], [-38, 32]], GREY);
  },
  bolt(ctx) { polygon(ctx, [[8, -46], [-24, 6], [-3, 6], [-12, 46], [26, -8], [3, -8]], GOLD); },
  drop(ctx) {
    ctx.beginPath(); ctx.moveTo(0, -46); ctx.bezierCurveTo(14, -24, 34, -6, 34, 14); ctx.bezierCurveTo(34, 34, 18, 46, 0, 46); ctx.bezierCurveTo(-18, 46, -34, 34, -34, 14); ctx.bezierCurveTo(-34, -6, -14, -24, 0, -46); ctx.closePath(); fillStroke(ctx, WATER);
    ctx.beginPath(); ctx.arc(-6, 18, 18, Math.PI * 0.75, Math.PI * 1.1); stroke(ctx, 5, WHITE);
  },
  flame(ctx, t) {
    const sway = Math.sin(t * 7) * 3;
    ctx.beginPath(); ctx.moveTo(sway, -46); ctx.bezierCurveTo(12, -22, 36, -8, 32, 18); ctx.bezierCurveTo(30, 36, 14, 46, 0, 46); ctx.bezierCurveTo(-14, 46, -32, 36, -32, 16); ctx.bezierCurveTo(-32, 0, -14, -8, -12, -26); ctx.bezierCurveTo(-4, -20, -2, -12, sway, -46); ctx.closePath(); fillStroke(ctx, ORANGE);
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.bezierCurveTo(10, 10, 20, 18, 14, 32); ctx.bezierCurveTo(10, 40, -10, 40, -14, 30); ctx.bezierCurveTo(-18, 18, -6, 10, 0, -4); ctx.closePath(); ctx.fillStyle = GOLD; ctx.fill();
  },
  leaf(ctx) {
    ctx.beginPath(); ctx.moveTo(-38, 32); ctx.bezierCurveTo(-42, -20, 0, -46, 40, -42); ctx.bezierCurveTo(42, 0, 20, 40, -38, 32); ctx.closePath(); fillStroke(ctx, GREEN);
    polyline(ctx, [[-38, 32], [18, -24]], 4, WHITE);
    polyline(ctx, [[-14, 10], [-14, -10]], 3, WHITE); polyline(ctx, [[2, -6], [24, -2]], 3, WHITE);
  },
  sun(ctx, t) {
    for (let i = 0; i < 12; i++) { const a = (i * TAU) / 12 + t * 0.5; polyline(ctx, [[Math.cos(a) * 32, Math.sin(a) * 32], [Math.cos(a) * 46, Math.sin(a) * 46]], 5, GOLD_DARK); }
    circle(ctx, 0, 0, 26, GOLD);
  },
  moon(ctx) {
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 38, 0, TAU); ctx.clip();
    ctx.beginPath(); ctx.arc(0, 0, 38, 0, TAU); ctx.fillStyle = '#F6D56B'; ctx.fill();
    ctx.beginPath(); ctx.arc(18, -10, 32, 0, TAU); ctx.fillStyle = PANEL; ctx.fill(); stroke(ctx, LINE);
    ctx.restore();
    ctx.beginPath(); ctx.arc(0, 0, 38, 0.55, Math.PI * 1.52); stroke(ctx, LINE);
  },
  magnifier(ctx) {
    polyline(ctx, [[12, 12], [40, 40]], 16, INK); polyline(ctx, [[12, 12], [40, 40]], 8, WOOD);
    circle(ctx, -8, -8, 28, '#CFEAF5');
    ctx.beginPath(); ctx.arc(-8, -8, 17, Math.PI * 1.1, Math.PI * 1.55); stroke(ctx, 4, WHITE);
  },
  gear(ctx, t) {
    ctx.save(); ctx.rotate(t * 0.6);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8; const w = 0.16;
      ctx.lineTo(Math.cos(a - w - 0.1) * 32, Math.sin(a - w - 0.1) * 32);
      ctx.lineTo(Math.cos(a - w) * 44, Math.sin(a - w) * 44);
      ctx.lineTo(Math.cos(a + w) * 44, Math.sin(a + w) * 44);
      ctx.lineTo(Math.cos(a + w + 0.1) * 32, Math.sin(a + w + 0.1) * 32);
    }
    ctx.closePath(); fillStroke(ctx, '#9BA3AB');
    circle(ctx, 0, 0, 13, PANEL);
    ctx.restore();
  },
  book(ctx) {
    polygon(ctx, [[-48, -22], [0, -12], [48, -22], [48, 38], [0, 46], [-48, 38]], BLUE);
    polygon(ctx, [[-42, -28], [0, -18], [0, 38], [-42, 30]], WHITE);
    polygon(ctx, [[42, -28], [0, -18], [0, 38], [42, 30]], '#F6F0E0');
    [-12, 0, 12].forEach(y => { polyline(ctx, [[-34, -14 + y], [-8, -8 + y]], 3); polyline(ctx, [[34, -14 + y], [8, -8 + y]], 3); });
  },
  shield(ctx) {
    ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(38, -32); ctx.lineTo(34, 8); ctx.quadraticCurveTo(28, 32, 0, 48); ctx.quadraticCurveTo(-28, 32, -34, 8); ctx.lineTo(-38, -32); ctx.closePath(); fillStroke(ctx, BLUE);
    polyline(ctx, [[-16, 2], [-4, 16], [18, -12]], 8, WHITE);
  },
  star(ctx, t) {
    const k = 1 + Math.sin(t * 4) * 0.05; ctx.scale(k, k);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2; const r = i % 2 ? 19 : 46; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r + 3); }
    ctx.closePath(); fillStroke(ctx, GOLD);
  },
  flask(ctx, t) {
    ctx.beginPath(); ctx.moveTo(-11, -44); ctx.lineTo(-11, -14); ctx.lineTo(-40, 34); ctx.quadraticCurveTo(-44, 44, -32, 44); ctx.lineTo(32, 44); ctx.quadraticCurveTo(44, 44, 40, 34); ctx.lineTo(11, -14); ctx.lineTo(11, -44); ctx.closePath(); fillStroke(ctx, '#EAF6FB');
    ctx.save(); ctx.clip(); ctx.beginPath(); ctx.rect(-50, 8, 100, 50); ctx.fillStyle = GREEN; ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.moveTo(-11, -44); ctx.lineTo(-11, -14); ctx.lineTo(-40, 34); ctx.quadraticCurveTo(-44, 44, -32, 44); ctx.lineTo(32, 44); ctx.quadraticCurveTo(44, 44, 40, 34); ctx.lineTo(11, -14); ctx.lineTo(11, -44); ctx.closePath(); stroke(ctx, LINE);
    polyline(ctx, [[-16, -44], [16, -44]], 6);
    for (let i = 0; i < 3; i++) circle(ctx, -8 + i * 10, 28 - ((t * 20 + i * 11) % 30), 3 + (i % 2), WHITE, 2);
  },
  planet(ctx) {
    ctx.beginPath(); ctx.ellipse(0, 0, 48, 14, -0.4, 0, TAU); stroke(ctx, 9, INK);
    ctx.beginPath(); ctx.ellipse(0, 0, 48, 14, -0.4, 0, TAU); stroke(ctx, 4, GOLD);
    circle(ctx, 0, 0, 28, ORANGE);
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.clip(); polyline(ctx, [[-30, -8], [30, -14]], 6, '#F4B46F'); polyline(ctx, [[-30, 10], [30, 4]], 6, '#C96F38'); ctx.restore();
    ctx.beginPath(); ctx.ellipse(0, 0, 48, 14, -0.4, 0.2, Math.PI - 0.2); stroke(ctx, 9, INK);
    ctx.beginPath(); ctx.ellipse(0, 0, 48, 14, -0.4, 0.2, Math.PI - 0.2); stroke(ctx, 4, GOLD);
  },
  chip(ctx) {
    for (let i = -2; i <= 2; i++) {
      for (const [dx, dy, w, h] of [[i * 14 - 2, -42, 4, 14], [i * 14 - 2, 28, 4, 14], [-42, i * 14 - 2, 14, 4], [28, i * 14 - 2, 14, 4]]) { ctx.fillStyle = GREY; ctx.fillRect(dx, dy, w, h); }
    }
    roundRect(ctx, -28, -28, 56, 56, 8); fillStroke(ctx, NAVY);
    text(ctx, 'AI', 0, 2, { size: 28, color: WHITE, weight: 900 });
  },
  people(ctx) {
    for (const [x, color] of [[-18, BLUE], [18, GREEN]]) {
      ctx.beginPath(); ctx.ellipse(x, 40, 22, 26, 0, Math.PI, TAU); ctx.closePath(); fillStroke(ctx, color);
      circle(ctx, x, -8, 15, '#F4D2B0');
    }
  },
  target(ctx) {
    circle(ctx, 0, 0, 40, RED); circle(ctx, 0, 0, 28, WHITE, 3); circle(ctx, 0, 0, 17, RED, 3); circle(ctx, 0, 0, 6, WHITE, 3);
    polyline(ctx, [[0, 0], [38, -38]], 5);
    polygon(ctx, [[38, -38], [30, -46], [46, -46], [46, -30], [38, -30]], GOLD, 3);
  },
  calendar(ctx) {
    roundRect(ctx, -38, -30, 76, 74, 8); fillStroke(ctx, WHITE);
    roundRect(ctx, -38, -30, 76, 22, 8); fillStroke(ctx, RED);
    roundRect(ctx, -22, -40, 8, 18, 3); fillStroke(ctx, GREY, 3); roundRect(ctx, 14, -40, 8, 18, 3); fillStroke(ctx, GREY, 3);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { ctx.fillStyle = r === 1 && c === 2 ? GOLD : '#D9D3C2'; ctx.fillRect(-28 + c * 16, 2 + r * 14, 11, 9); }
  },
  warning(ctx) {
    ctx.beginPath(); ctx.moveTo(0, -42); ctx.lineTo(44, 34); ctx.lineTo(-44, 34); ctx.closePath(); ctx.lineJoin = 'round'; fillStroke(ctx, GOLD);
    roundRect(ctx, -4.5, -14, 9, 28, 4); ctx.fillStyle = INK; ctx.fill();
    circle(ctx, 0, 24, 5, INK, 0);
  },
  question(ctx) { circle(ctx, 0, 0, 40, BLUE); text(ctx, '?', 0, 4, { size: 66, color: WHITE, weight: 900 }); },
  check(ctx) { circle(ctx, 0, 0, 40, GREEN); polyline(ctx, [[-18, 2], [-5, 16], [20, -14]], 9, WHITE); },
  bell(ctx, t) {
    ctx.save(); ctx.translate(0, -36); ctx.rotate(Math.sin(t * 9) * 0.18); ctx.translate(0, 36);
    ctx.beginPath(); ctx.moveTo(-32, 24); ctx.quadraticCurveTo(-32, -30, 0, -32); ctx.quadraticCurveTo(32, -30, 32, 24); ctx.closePath(); fillStroke(ctx, GOLD);
    polyline(ctx, [[-40, 24], [40, 24]], 7); circle(ctx, 0, 33, 7, GOLD_DARK); circle(ctx, 0, -38, 5, GOLD_DARK, 4);
    ctx.restore();
  },
  chat(ctx) {
    ctx.beginPath(); ctx.moveTo(-40, -30); ctx.lineTo(40, -30); ctx.quadraticCurveTo(46, -30, 46, -24); ctx.lineTo(46, 12); ctx.quadraticCurveTo(46, 18, 40, 18); ctx.lineTo(-8, 18); ctx.lineTo(-26, 38); ctx.lineTo(-24, 18); ctx.lineTo(-40, 18); ctx.quadraticCurveTo(-46, 18, -46, 12); ctx.lineTo(-46, -24); ctx.quadraticCurveTo(-46, -30, -40, -30); ctx.closePath(); fillStroke(ctx, WHITE);
    [-18, 0, 18].forEach(x => circle(ctx, x, -6, 4.5, INK, 0));
  },
  apple(ctx) {
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.bezierCurveTo(-30, -34, -48, -4, -34, 22); ctx.bezierCurveTo(-24, 42, -10, 44, 0, 38); ctx.bezierCurveTo(10, 44, 24, 42, 34, 22); ctx.bezierCurveTo(48, -4, 30, -34, 0, -20); ctx.closePath(); fillStroke(ctx, RED);
    polyline(ctx, [[0, -20], [4, -38]], 5);
    ctx.beginPath(); ctx.moveTo(4, -34); ctx.quadraticCurveTo(22, -50, 32, -36); ctx.quadraticCurveTo(18, -26, 4, -34); ctx.closePath(); fillStroke(ctx, GREEN, 4);
  },
  paw(ctx) {
    ellipse(ctx, 0, 18, 24, 20, WOOD);
    [[-30, -8, 0.3], [-11, -26, 0.1], [11, -26, -0.1], [30, -8, -0.3]].forEach(([x, y, r]) => ellipse(ctx, x, y, 9, 13, WOOD, r));
  },
  pill(ctx) {
    ctx.save(); ctx.rotate(-0.6);
    roundRect(ctx, -44, -18, 88, 36, 18); ctx.fillStyle = WHITE; ctx.fill();
    ctx.save(); roundRect(ctx, -44, -18, 88, 36, 18); ctx.clip(); ctx.fillStyle = RED; ctx.fillRect(-44, -20, 46, 40); ctx.restore();
    roundRect(ctx, -44, -18, 88, 36, 18); stroke(ctx, LINE); polyline(ctx, [[2, -18], [2, 18]], 4);
    ctx.restore();
  },
  mountain(ctx) {
    polygon(ctx, [[-48, 38], [-14, -26], [10, 10], [22, -8], [48, 38]], '#7C8B96');
    polygon(ctx, [[-14, -26], [-26, -4], [-18, -8], [-12, 0], [-6, -8], [2, -4]], WHITE, 3);
    circle(ctx, 30, -30, 9, GOLD, 4);
  }
};

export const ICON_NAMES = Object.keys(ICONS);

// Draws `name` centred on (x, y), `size` pixels wide; an unknown name falls back to a star.
export function drawIcon(ctx, name, x, y, size = 100, t = 0) {
  const icon = ICONS[name] || ICONS.star;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  icon(ctx, t);
  ctx.restore();
}
