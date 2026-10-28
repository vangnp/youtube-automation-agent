import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { INK, PAPER, drawTemplate } from './canvas-scenes.js';
import { Mascot } from './Mascot.jsx';

// Vertical explainer in the flat-infographic style: a headline card, a canvas-drawn illustration
// panel, white word-synced captions and the channel mascot. Everything is driven by the storyboard.
const FONT = "Arial, Helvetica, 'Liberation Sans', sans-serif";
const CANVAS = { width: 980, height: 800 };

const Dots = () => (
  <svg width="1080" height="1920" style={{ position: 'absolute', inset: 0 }}>
    {Array.from({ length: 12 * 20 }, (_, i) => (
      <circle key={i} cx={45 + (i % 12) * 90 + ((Math.floor(i / 12) % 2) * 45)} cy={30 + Math.floor(i / 12) * 96} r="3.5" fill="#D9D3C2" />
    ))}
  </svg>
);

const SceneCanvas = ({ template, labels, data }) => {
  const ref = useRef(null);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Layout effect: the canvas is repainted for this exact frame before Remotion captures it.
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    drawTemplate(template, canvas.getContext('2d'), CANVAS, frame / fps, labels, data);
  }, [template, labels, data, frame, fps]);
  return <canvas ref={ref} width={CANVAS.width} height={CANVAS.height} style={{ width: '100%', height: '100%', display: 'block' }} />;
};

const HeaderCard = ({ headline, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 15, stiffness: 110 } });
  const size = headline.length > 18 ? 84 : headline.length > 12 ? 100 : 116;
  return (
    <div style={{
      position: 'absolute', left: 44, top: 64, width: 992, height: 350, boxSizing: 'border-box',
      background: '#FFFDF8', border: `6px solid ${INK}`, borderRadius: 40, textAlign: 'center',
      display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 36px', fontFamily: FONT,
      opacity: enter, transform: `translateY(${(1 - enter) * -60}px)`
    }}>
      <div style={{ color: '#B84E4F', fontSize: size, fontWeight: 900, lineHeight: 1.08 }}>{headline}</div>
      {subtitle ? <div style={{ color: INK, fontSize: 58, fontWeight: 800, lineHeight: 1.2, marginTop: 14 }}>{subtitle}</div> : null}
    </div>
  );
};

const Panel = ({ template, labels, data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 4, fps, config: { damping: 16, stiffness: 100 } });
  return (
    <div style={{
      position: 'absolute', left: 44, top: 454, width: 992, height: 812, boxSizing: 'border-box',
      border: `6px solid ${INK}`, borderRadius: 40, overflow: 'hidden', background: '#E9E7DE',
      opacity: enter, transform: `translateY(${(1 - enter) * 80}px)`
    }}>
      <SceneCanvas template={template} labels={labels} data={data} />
    </div>
  );
};

// White captions with a dark outline. Words already spoken are solid white, the ones still to come are
// dimmer, and the word being spoken is lifted slightly, so the text follows the voice exactly.
const Captions = ({ phrases }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const now = frame / fps;
  const phrase = phrases.find((entry, i) => {
    const next = phrases[i + 1];
    return now >= entry.start - 0.08 && now < Math.min(entry.end + 0.3, next ? next.start - 0.02 : Infinity);
  });
  if (!phrase) return null;
  const fade = interpolate(now, [phrase.start - 0.08, phrase.start + 0.06], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{
      position: 'absolute', left: 60, right: 60, top: 1312, height: 230, display: 'flex', flexWrap: 'wrap',
      justifyContent: 'center', alignContent: 'center', gap: '2px 26px', fontFamily: FONT, opacity: fade
    }}>
      {phrase.words.map((word, i) => {
        const spoken = now >= word.start;
        const active = spoken && now < word.end + 0.04;
        return (
          <span key={i} style={{
            fontSize: 70, fontWeight: 900, lineHeight: 1.25, color: '#FFFFFF', opacity: spoken ? 1 : 0.55,
            WebkitTextStroke: '8px #242522', paintOrder: 'stroke fill', letterSpacing: 1.5, textShadow: '0 4px 0 rgba(36,37,34,0.3)',
            transform: `translateY(${active ? -5 : 0}px) scale(${active ? 1.06 : 1})`, display: 'inline-block'
          }}>{word.text}</span>
        );
      })}
    </div>
  );
};

export const InfoVideo = ({ scenes, phrases = [], audioFile, mascotFile, mouthEnvelope = [], brand = 'YANG TÒ MÒ' }) => {
  const { fps } = useVideoConfig();
  const moods = scenes.map(scene => ({ start: scene.start, mood: scene.mood || 'neutral' }));
  const spoken = phrases.flatMap(phrase => phrase.words);
  return (
    <AbsoluteFill style={{ backgroundColor: PAPER, fontFamily: FONT }}>
      <Dots />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1290, bottom: 0, background: '#E7DEC6' }} />
      {scenes.map((scene, index) => {
        const from = Math.round(scene.start * fps);
        // The previous scene stays underneath for a moment so the next one fades in over it.
        const tail = index === scenes.length - 1 ? 0 : Math.round(0.3 * fps);
        return (
          <Sequence key={index} from={from} durationInFrames={Math.max(1, Math.round(scene.duration * fps) + tail)}>
            <HeaderCard headline={scene.headline} subtitle={scene.subtitle} />
            <Panel template={scene.template} labels={scene.labels} data={scene.data} />
          </Sequence>
        );
      })}
      <div style={{ position: 'absolute', left: 54, bottom: 56, fontSize: 40, fontWeight: 900, color: '#B84E4F', letterSpacing: 2 }}>{brand}</div>
      <div style={{ position: 'absolute', left: 54, bottom: 14, fontSize: 28, fontWeight: 700, color: INK }}>Tò mò một chút, hiểu biết nhiều hơn</div>
      <Captions phrases={phrases} />
      {mascotFile ? <Mascot src={mascotFile} envelope={mouthEnvelope} words={spoken} moods={moods} height={390} right={24} bottom={0} /> : null}
      {audioFile ? <Audio src={staticFile(audioFile)} /> : null}
    </AbsoluteFill>
  );
};
