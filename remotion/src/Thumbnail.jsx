import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, staticFile, useCurrentFrame } from 'remotion';
import { INK, PAPER, PANEL, glassWithIce, sparkle, roundRect, stroke, RED, GOLD, WHITE, GREEN, BLUE, drawIcon } from './canvas-scenes.js';
import { Mascot } from './Mascot.jsx';

// 1280x720 YouTube thumbnail, painted on a canvas in the same flat style as the video.
const W = 1280;
const H = 720;

// Draws the line at `size`, shrunk when it would be wider than `maxWidth`.
function outlinedText(ctx, value, x, y, size, fill, outline = 16, maxWidth = 660) {
  ctx.font = `900 ${size}px Arial, Helvetica, sans-serif`;
  const width = ctx.measureText(value).width;
  const fitted = width > maxWidth ? Math.floor((size * maxWidth) / width) : size;
  ctx.font = `900 ${fitted}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round'; ctx.lineWidth = outline * (fitted / size); ctx.strokeStyle = INK;
  ctx.strokeText(value, x, y);
  ctx.fillStyle = fill; ctx.fillText(value, x, y);
}

function paint(ctx, { title, kicker, accent, icon }) {
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#D9D3C2';
  for (let y = 24; y < H; y += 64) for (let x = (y / 64) % 2 ? 30 : 0; x < W; x += 60) { ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); }

  // illustration card on the right
  ctx.save();
  ctx.shadowColor = 'rgba(36,37,34,0.25)'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 12;
  roundRect(ctx, 740, 40, 510, 640, 44); ctx.fillStyle = PANEL; ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, 740, 40, 510, 640, 44); ctx.clip();
  if (icon) {
    // generic art: the topic icon on a white disc with a few question marks around it
    ctx.beginPath(); ctx.arc(925, 262, 168, 0, Math.PI * 2); ctx.fillStyle = WHITE; ctx.fill(); stroke(ctx, 8);
    drawIcon(ctx, icon, 925, 262, 255, 1.5);
    [['?', 800, 90, 80, RED, -0.2], ['?', 1190, 150, 110, BLUE, 0.2], ['?', 810, 560, 110, GOLD, 0.2], ['?', 1060, 80, 70, GREEN, -0.2]].forEach(([mark, x, y, size, color, tilt]) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
      ctx.font = `900 ${size}px Arial, Helvetica, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = 14; ctx.strokeStyle = INK; ctx.strokeText(mark, 0, 0); ctx.fillStyle = color; ctx.fillText(mark, 0, 0);
      ctx.restore();
    });
  } else {
    ctx.translate(920 - 490 * 0.7, 360 - 420 * 0.7); ctx.scale(0.7, 0.7);
    glassWithIce(ctx, { t: 1.4, labels: ['', ''] });
  }
  ctx.restore();
  roundRect(ctx, 740, 40, 510, 640, 44); stroke(ctx, 10);

  // headline
  ctx.save();
  ctx.translate(48, 0);
  const lines = title.split('\n');
  lines.forEach((line, i) => outlinedText(ctx, line, 0, i === 0 ? 290 : 410, i === 0 ? 176 : 104, i === 0 ? RED : WHITE, i === 0 ? 14 : 12));
  ctx.restore();

  // kicker pill
  ctx.font = '900 54px Arial, Helvetica, sans-serif';
  const width = ctx.measureText(kicker).width + 70;
  ctx.save(); ctx.translate(48, 470);
  ctx.rotate(-0.03);
  roundRect(ctx, 0, 0, width, 100, 24); ctx.fillStyle = accent; ctx.fill(); stroke(ctx, 7);
  ctx.fillStyle = WHITE; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(kicker, 35, 52);
  ctx.restore();

  sparkle(ctx, 700, 80, 40); sparkle(ctx, 1215, 640, 30); sparkle(ctx, 690, 620, 22);
}

export const Thumbnail = ({ title = 'ĐÁ NỔI\nTRÊN NƯỚC?', kicker = 'KHOA HỌC VUI', icon = null, mascotFile = 'mascot.svg' }) => {
  const ref = useRef(null);
  const frame = useCurrentFrame();
  useLayoutEffect(() => {
    const ctx = ref.current && ref.current.getContext('2d');
    if (ctx) paint(ctx, { title, kicker, accent: '#4E8A74', icon });
  }, [title, kicker, icon, frame]);
  return (
    <AbsoluteFill>
      <canvas ref={ref} width={W} height={H} style={{ width: W, height: H }} />
      {mascotFile ? <Mascot src={mascotFile} words={[]} moods={[{ start: 0, mood: 'surprised' }]} height={440} right={20} bottom={-10} instant /> : null}
    </AbsoluteFill>
  );
};
