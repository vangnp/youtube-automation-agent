import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

// Illustrations drawn entirely by code (SVG driven by the frame number), used for scenes that have no
// generated image. Palette follows the channel: night blue and gold with a few accent colours.
const W = 1100;
const H = 560;
const GOLD = '#ffd23f';
const BLUE = '#5ec2ff';
const NIGHT = '#0d1b3d';

const useTime = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return { t: frame / fps, frame };
};

const seeded = i => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const wavePath = (t, y, amp, length, speed, phase = 0) => {
  let d = `M0 ${H}`;
  for (let x = 0; x <= W; x += 20) {
    d += ` L${x} ${(y + Math.sin((x / length) * Math.PI * 2 + t * speed + phase) * amp).toFixed(1)}`;
  }
  return `${d} L${W} ${H} Z`;
};

const Stars = ({ count = 40, seed = 0 }) => {
  const { t } = useTime();
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const x = seeded(i + seed) * W;
        const y = seeded(i * 3 + seed + 9) * H;
        const r = 1.5 + seeded(i + 21) * 2.5;
        const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.8 + seeded(i + 4)) + i));
        return <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={twinkle} />;
      })}
    </g>
  );
};

const Bubbles = ({ count = 14, color = '#bfe9ff' }) => {
  const { t } = useTime();
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const speed = 40 + seeded(i) * 60;
        const y = H - ((t * speed + seeded(i + 5) * H) % (H + 40)) + 20;
        const x = seeded(i + 11) * W + Math.sin(t * 2 + i) * 14;
        const r = 6 + seeded(i + 3) * 14;
        return <circle key={i} cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth="3" opacity="0.7" />;
      })}
    </g>
  );
};

const Water = () => {
  const { t } = useTime();
  const bob = Math.sin(t * 1.6) * 14;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
      <defs>
        <linearGradient id="vw1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3aa8ff" /><stop offset="1" stopColor="#0b3d91" /></linearGradient>
        <linearGradient id="vice" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f3fcff" /><stop offset="1" stopColor="#9fdcff" /></linearGradient>
      </defs>
      <g transform={`translate(0 ${bob})`}>
        <rect x="430" y="150" width="220" height="220" rx="34" fill="url(#vice)" stroke="#d9f4ff" strokeWidth="6" opacity="0.95" />
        <path d="M462 190 L540 190 M462 218 L500 218" stroke="#fff" strokeWidth="10" strokeLinecap="round" opacity="0.8" />
        <circle cx="600" cy="320" r="10" fill="#fff" opacity="0.5" />
      </g>
      <path d={wavePath(t, 300, 16, 330, 2.2)} fill="url(#vw1)" opacity="0.92" />
      <path d={wavePath(t, 340, 14, 260, -1.6, 1)} fill="#1b64c9" opacity="0.8" />
      <path d={wavePath(t, 390, 12, 380, 1.1, 2)} fill="#0b3d91" opacity="0.9" />
      <Bubbles />
    </svg>
  );
};

const Lattice = ({ rock = false }) => {
  const { t } = useTime();
  const pulse = 1 + Math.sin(t * 2) * 0.05;
  const cells = [];
  for (let row = -3; row <= 3; row++) {
    for (let col = -4; col <= 4; col++) {
      const x = 550 + col * 110 + (row % 2 ? 55 : 0);
      const y = 280 + row * 86;
      cells.push([x, y, row, col]);
    }
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
      <g transform={`translate(550 280) scale(${pulse}) rotate(${Math.sin(t * 0.5) * 4}) translate(-550 -280)`}>
        {cells.map(([x, y, row, col]) => (
          <g key={`${row}-${col}`}>
            <polygon
              points={[0, 1, 2, 3, 4, 5].map(k => `${(x + Math.cos((k * Math.PI) / 3 + Math.PI / 6) * 46).toFixed(1)},${(y + Math.sin((k * Math.PI) / 3 + Math.PI / 6) * 46).toFixed(1)}`).join(' ')}
              fill="none" stroke={rock ? '#e0a96d' : '#bfe9ff'} strokeWidth="4" opacity="0.7"
            />
            <circle cx={x} cy={y} r="13" fill={rock ? '#c58a52' : '#ff7a7a'} opacity={0.6 + 0.4 * Math.abs(Math.sin(t * 2 + row + col))} />
          </g>
        ))}
      </g>
    </svg>
  );
};

const Molecule = () => {
  const { t } = useTime();
  const one = (cx, cy, scale, speed, phase) => {
    const angle = Math.sin(t * speed + phase) * 0.35;
    const arm = (side) => {
      const a = Math.PI / 2 + side * 0.9 + angle;
      return [cx + Math.cos(a) * 110 * scale, cy + Math.sin(a) * 110 * scale];
    };
    const [lx, ly] = arm(-1);
    const [rx, ry] = arm(1);
    return (
      <g key={`${cx}-${cy}`}>
        <line x1={cx} y1={cy} x2={lx} y2={ly} stroke="#fff" strokeWidth={8 * scale} opacity="0.7" />
        <line x1={cx} y1={cy} x2={rx} y2={ry} stroke="#fff" strokeWidth={8 * scale} opacity="0.7" />
        <circle cx={cx} cy={cy} r={58 * scale} fill="#ff5a5a" stroke="#ffd0d0" strokeWidth="5" />
        <circle cx={lx} cy={ly} r={34 * scale} fill="#6fd3ff" stroke="#e1f6ff" strokeWidth="5" />
        <circle cx={rx} cy={ry} r={34 * scale} fill="#6fd3ff" stroke="#e1f6ff" strokeWidth="5" />
      </g>
    );
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
      {one(550, 230 + Math.sin(t * 1.4) * 10, 1.35, 1.6, 0)}
      {one(210, 140 + Math.sin(t * 1.1 + 2) * 12, 0.65, 1.2, 1.5)}
      {one(900, 360 + Math.sin(t * 1.3 + 4) * 12, 0.7, 1.4, 3)}
    </svg>
  );
};

const Space = () => {
  const { t } = useTime();
  const mx = 550 + Math.cos(t * 0.9) * 330;
  const my = 280 + Math.sin(t * 0.9) * 90;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
      <defs>
        <radialGradient id="vpl" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#ffd9a0" /><stop offset="0.6" stopColor="#e8873a" /><stop offset="1" stopColor="#8a3a1a" /></radialGradient>
      </defs>
      <Stars count={60} />
      <ellipse cx="550" cy="280" rx="330" ry="90" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.3" strokeDasharray="8 10" />
      <ellipse cx="550" cy="290" rx="230" ry="46" fill="none" stroke={GOLD} strokeWidth="14" opacity="0.55" transform="rotate(-14 550 290)" />
      <circle cx="550" cy="280" r="130" fill="url(#vpl)" />
      <circle cx={mx} cy={my} r="26" fill="#dfe6f2" stroke="#fff" strokeWidth="3" />
    </svg>
  );
};

const Earth = () => {
  const { t } = useTime();
  const shift = (t * 60) % 520;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
      <defs>
        <clipPath id="vgl"><circle cx="550" cy="280" r="190" /></clipPath>
        <radialGradient id="voc" cx="0.35" cy="0.3" r="0.9"><stop offset="0" stopColor="#5fc4ff" /><stop offset="1" stopColor="#0a3d91" /></radialGradient>
      </defs>
      <Stars count={50} seed={7} />
      <circle cx="550" cy="280" r="214" fill="#5ec2ff" opacity="0.16" />
      <circle cx="550" cy="280" r="190" fill="url(#voc)" />
      <g clipPath="url(#vgl)">
        {[0, 1].map(k => (
          <g key={k} transform={`translate(${-shift + k * 520} 0)`} fill="#4fbf6a" opacity="0.92">
            <path d="M380 210 Q430 150 500 190 Q540 220 500 270 Q440 300 400 270 Z" />
            <path d="M620 300 Q690 270 740 320 Q760 390 700 410 Q640 380 620 300 Z" />
            <path d="M560 130 Q610 110 640 150 Q620 190 570 180 Z" />
          </g>
        ))}
      </g>
      <circle cx="550" cy="280" r="190" fill="none" stroke="#bfe9ff" strokeWidth="4" opacity="0.5" />
    </svg>
  );
};

const Sun = () => {
  const { t } = useTime();
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
      <g transform={`translate(550 280) rotate(${t * 12})`}>
        {Array.from({ length: 16 }, (_, i) => (
          <rect key={i} x="-10" y={-250 - (i % 2) * 30} width="20" height={90 + (i % 2) * 30} rx="10"
            fill={GOLD} opacity="0.85" transform={`rotate(${i * 22.5})`} />
        ))}
      </g>
      <circle cx="550" cy="280" r={150 + Math.sin(t * 2) * 6} fill="#ffe27a" opacity="0.35" />
      <circle cx="550" cy="280" r="118" fill="#ffc933" stroke="#fff2b0" strokeWidth="8" />
    </svg>
  );
};

const Brain = () => {
  const { t } = useTime();
  const nodes = Array.from({ length: 16 }, (_, i) => [
    550 + Math.cos(i * 2.4) * (60 + (i % 4) * 55), 280 + Math.sin(i * 2.4) * (50 + (i % 3) * 45)
  ]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
      <ellipse cx="550" cy="280" rx="280" ry="200" fill="#6b3fa0" opacity="0.35" stroke="#c9a6ff" strokeWidth="6" />
      <path d="M550 90 Q540 280 550 470" stroke="#c9a6ff" strokeWidth="5" opacity="0.5" fill="none" />
      {nodes.map(([x, y], i) => nodes.slice(i + 1, i + 3).map(([x2, y2], k) => (
        <line key={`${i}-${k}`} x1={x} y1={y} x2={x2} y2={y2} stroke="#e7d5ff" strokeWidth="3" opacity="0.5" />
      )))}
      {nodes.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={9 + 7 * Math.abs(Math.sin(t * 2.4 + i))} fill={i % 3 ? BLUE : GOLD} opacity="0.95" />
      ))}
    </svg>
  );
};

const Lightning = () => {
  const { t } = useTime();
  const flash = Math.max(0, Math.sin(t * 3.1)) ** 12;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
      <rect width={W} height={H} fill="#fff" opacity={flash * 0.18} />
      <g fill="#8a95b8">
        <circle cx="430" cy="160" r="80" /><circle cx="520" cy="130" r="95" /><circle cx="630" cy="160" r="85" /><rect x="380" y="150" width="330" height="80" rx="40" />
      </g>
      <polygon points="560,230 500,350 550,350 520,480 650,320 590,320 630,230" fill={GOLD} stroke="#fff6c0" strokeWidth="6" opacity={0.35 + flash * 0.65} />
    </svg>
  );
};

const Rock = () => {
  const { t } = useTime();
  const bob = Math.sin(t * 1.5) * 12;
  const pores = Array.from({ length: 16 }, (_, i) => [440 + seeded(i) * 220, 170 + seeded(i + 8) * 150, 8 + seeded(i + 3) * 14]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
      <g transform={`translate(0 ${bob})`}>
        <path d="M410 330 Q400 200 520 160 Q650 130 700 230 Q740 330 640 370 Q500 400 410 330 Z" fill="#9a8f86" stroke="#d5cbc2" strokeWidth="6" />
        {pores.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#6f655d" opacity="0.8" />)}
      </g>
      <path d={wavePath(t, 330, 14, 300, 2.0)} fill="#2a7de1" opacity="0.9" />
      <path d={wavePath(t, 380, 12, 360, -1.4, 1)} fill="#0b3d91" opacity="0.92" />
      <Bubbles count={10} />
    </svg>
  );
};

const Volcano = () => {
  const { t } = useTime();
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
      <polygon points="260,500 550,170 840,500" fill="#6b4a3a" stroke="#a37a62" strokeWidth="6" />
      <polygon points="480,230 550,170 620,230 590,250 550,225 510,250" fill="#ff7a2f" />
      {Array.from({ length: 10 }, (_, i) => {
        const life = (t * 0.7 + i * 0.37) % 1;
        const x = 550 + Math.sin(i * 2.1) * 140 * life;
        const y = 190 - 170 * Math.sin(life * Math.PI) + life * 30;
        return <circle key={i} cx={x} cy={y} r={12 + (i % 3) * 5} fill={i % 2 ? '#ff9a3c' : '#ff5a1f'} opacity={1 - life * 0.6} />;
      })}
    </svg>
  );
};

const Scale = () => {
  const { t } = useTime();
  const tilt = Math.sin(t * 1.2) * 10 + 8;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
      <rect x="535" y="170" width="30" height="300" rx="10" fill="#d8b46a" />
      <rect x="440" y="470" width="220" height="26" rx="12" fill="#d8b46a" />
      <g transform={`rotate(${tilt} 550 180)`}>
        <rect x="260" y="168" width="580" height="24" rx="12" fill={GOLD} />
        <g transform={`translate(0 ${0}) rotate(${-tilt} 290 190)`}>
          <line x1="290" y1="190" x2="290" y2="290" stroke="#fff" strokeWidth="4" /><rect x="210" y="290" width="160" height="16" rx="8" fill="#e8e8f0" />
          <circle cx="290" cy="262" r="30" fill="#9aa4bd" />
        </g>
        <g transform={`rotate(${-tilt} 810 190)`}>
          <line x1="810" y1="190" x2="810" y2="290" stroke="#fff" strokeWidth="4" /><rect x="730" y="290" width="160" height="16" rx="8" fill="#e8e8f0" />
          <rect x="775" y="236" width="70" height="54" rx="10" fill="#ff8f6b" />
        </g>
      </g>
    </svg>
  );
};

const Bulb = () => {
  const { t } = useTime();
  const glow = 0.5 + 0.5 * Math.sin(t * 2.4);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
      <circle cx="550" cy="250" r={170 + glow * 30} fill={GOLD} opacity={0.12 + glow * 0.1} />
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x="-6" y="-230" width="12" height="46" rx="6" fill={GOLD} opacity={0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i))}
          transform={`translate(550 250) rotate(${-90 + i * 20 - 10})`} />
      ))}
      <path d="M470 270 Q450 170 550 140 Q650 170 630 270 Q620 320 590 350 L590 380 L510 380 L510 350 Q480 320 470 270Z" fill="#ffe680" stroke="#fff3b0" strokeWidth="8" />
      <rect x="510" y="384" width="80" height="26" rx="8" fill="#6b7a99" /><rect x="520" y="414" width="60" height="20" rx="8" fill="#e8a12c" />
    </svg>
  );
};

const Orbit = () => {
  const { t } = useTime();
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
      <Stars count={30} seed={3} />
      {[110, 190, 270].map((r, i) => (
        <g key={r}>
          <ellipse cx="550" cy="280" rx={r * 1.5} ry={r * 0.62} fill="none" stroke="#fff" strokeWidth="2" opacity="0.25" />
          <circle cx={550 + Math.cos(t * (1.4 - i * 0.3) + i * 2) * r * 1.5} cy={280 + Math.sin(t * (1.4 - i * 0.3) + i * 2) * r * 0.62}
            r={14 + i * 4} fill={[GOLD, BLUE, '#ff8fb1'][i]} />
        </g>
      ))}
      <circle cx="550" cy="280" r={44 + Math.sin(t * 2) * 4} fill={GOLD} opacity="0.95" />
    </svg>
  );
};

const VISUALS = {
  water: Water, ice: () => <Lattice />, rock: Rock, molecule: Molecule, space: Space, earth: Earth,
  sun: Sun, brain: Brain, lightning: Lightning, volcano: Volcano, scale: Scale, bulb: Bulb, orbit: Orbit,
  pumice: Rock
};

// A code-drawn illustration that fades in with its scene. `dim` makes it a quiet backdrop behind a big title.
export const ProceduralVisual = ({ kind, dim = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const Visual = VISUALS[kind] || Orbit;
  const enter = interpolate(frame, [0, fps * 0.6], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <div style={{
      position: 'absolute', left: 160, top: 250, width: 1100, height: 560,
      opacity: (dim ? 0.3 : 1) * enter, transform: `scale(${0.92 + 0.08 * enter})`,
      // Fade the edges so wide shapes (water, lattice) never show a hard rectangular border.
      WebkitMaskImage: 'radial-gradient(ellipse at center, #000 58%, transparent 98%)',
      maskImage: 'radial-gradient(ellipse at center, #000 58%, transparent 98%)'
    }}>
      <Visual />
    </div>
  );
};

// Soft moving backdrop for every scene without an image: gradient, glow and drifting dots.
export const Backdrop = ({ index }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const hue = 225 + (index % 4) * 14;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden',
      background: `radial-gradient(circle at ${30 + Math.sin(t * 0.3) * 12}% ${35 + Math.cos(t * 0.25) * 10}%, hsl(${hue} 60% 28%) 0%, ${NIGHT} 70%)` }}>
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
        {Array.from({ length: 26 }, (_, i) => (
          <circle key={i} cx={(seeded(i) * width + t * (8 + seeded(i + 2) * 14)) % width}
            cy={(seeded(i + 7) * height + Math.sin(t * 0.6 + i) * 20)} r={2 + seeded(i + 4) * 4}
            fill={i % 4 ? '#ffffff' : GOLD} opacity={0.12 + 0.18 * Math.abs(Math.sin(t + i))} />
        ))}
      </svg>
    </div>
  );
};
