import React from 'react';
import {
  AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig
} from 'remotion';
import { Mascot } from './Mascot.jsx';

const FADE_SECONDS = 0.5;
const FONT = "'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

// Slow zoom and drift so a still image never looks frozen. Direction alternates per scene.
const KenBurns = ({ src, duration, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = interpolate(frame, [0, Math.max(1, duration * fps)], [0, 1], { extrapolateRight: 'clamp' });
  const zoomIn = index % 2 === 0;
  const scale = zoomIn ? 1.04 + progress * 0.12 : 1.16 - progress * 0.12;
  const driftX = (index % 3 === 0 ? -1 : 1) * progress * 40;
  const driftY = (index % 2 === 0 ? 1 : -1) * progress * 24;
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img
        src={staticFile(src)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale}) translate(${driftX}px, ${driftY}px)` }}
      />
    </AbsoluteFill>
  );
};

// Words slide up and fade in one after another.
const AnimatedTitle = ({ text, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const big = index === 0;
  return (
    <div style={{
      position: 'absolute', top: big ? '30%' : '12%', left: 0, right: 0, padding: '0 140px',
      display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 22px', fontFamily: FONT
    }}>
      {words.map((word, i) => {
        const entrance = spring({ frame: frame - i * 4, fps, config: { damping: 16, stiffness: 120 } });
        return (
          <span key={i} style={{
            fontSize: big ? 112 : 76, fontWeight: 800, color: '#fff', lineHeight: 1.15,
            textShadow: '0 4px 24px rgba(0,0,0,0.65)',
            opacity: entrance, transform: `translateY(${(1 - entrance) * 46}px) scale(${0.9 + entrance * 0.1})`
          }}>{word}</span>
        );
      })}
    </div>
  );
};

// Word-by-word captions in short phrases; the spoken word is highlighted and pops slightly.
const WORDS_PER_PHRASE = 5;
const Captions = ({ words, hasMascot, lead = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const now = frame / fps - lead;
  if (!words || !words.length) return null;
  const activeIndex = Math.max(0, words.findIndex(w => now >= w.start && now < w.end));
  const current = activeIndex === -1 ? 0 : activeIndex;
  const phraseStart = Math.floor(current / WORDS_PER_PHRASE) * WORDS_PER_PHRASE;
  const phrase = words.slice(phraseStart, phraseStart + WORDS_PER_PHRASE);
  const phraseOpacity = interpolate(now, [phrase[0].start, phrase[0].start + 0.15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{
      position: 'absolute', bottom: 110, left: 0, right: 0, padding: `0 ${hasMascot ? 520 : 180}px 0 180px`, display: 'flex',
      justifyContent: 'center', flexWrap: 'wrap', gap: '0 18px', fontFamily: FONT, opacity: phraseOpacity
    }}>
      {phrase.map((word, i) => {
        const absolute = phraseStart + i;
        const spoken = now >= word.start;
        const active = absolute === current && now < word.end + 0.05;
        const pop = active ? spring({ frame: frame - Math.round(word.start * fps), fps, config: { damping: 12, stiffness: 220 } }) : 1;
        return (
          <span key={absolute} style={{
            fontSize: 64, fontWeight: 800, lineHeight: 1.3, padding: '0 8px',
            color: active ? '#ffd23f' : spoken ? '#ffffff' : 'rgba(255,255,255,0.55)',
            textShadow: '0 3px 14px rgba(0,0,0,0.85)', WebkitTextStroke: '2px rgba(0,0,0,0.55)', paintOrder: 'stroke fill',
            transform: `scale(${active ? 1 + 0.08 * Math.min(1, pop) : 1})`
          }}>{word.text}</span>
        );
      })}
    </div>
  );
};

const Scene = ({ scene, index, fadeFrames, durationFrames, hasMascot, lead }) => {
  const frame = useCurrentFrame();
  const opacity = Math.min(
    interpolate(frame, [0, fadeFrames], [index === 0 ? 1 : 0, 1], { extrapolateRight: 'clamp' }),
    interpolate(frame, [durationFrames - fadeFrames, durationFrames], [1, 0], { extrapolateLeft: 'clamp' })
  );
  return (
    <AbsoluteFill style={{ opacity, background: 'linear-gradient(135deg, #1b1f3b 0%, #3a1c5c 100%)' }}>
      {scene.image ? <KenBurns src={scene.image} duration={scene.duration} index={index} /> : null}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.05) 45%, rgba(0,0,0,0.6) 100%)' }} />
      {scene.title ? <AnimatedTitle text={scene.title} index={index} /> : null}
      <Captions words={scene.words} hasMascot={hasMascot} lead={lead} />
    </AbsoluteFill>
  );
};

export const LumenVideo = ({ scenes, audioFile, mascotFile, mouthEnvelope = [] }) => {
  const { fps } = useVideoConfig();
  const fadeFrames = Math.round(FADE_SECONDS * fps);
  let cursor = 0;
  const spoken = [];
  const moods = [];
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {scenes.map((scene, index) => {
        let from;
        let durationFrames;
        let lead = 0;
        if (typeof scene.start === 'number') {
          // Speech-aligned: the scene is heard starting at scene.start. Begin the dissolve one fade
          // earlier so it has finished when the first word is spoken.
          const startFrame = Math.round(scene.start * fps);
          const pre = index === 0 ? 0 : fadeFrames;
          from = Math.max(0, startFrame - pre);
          durationFrames = Math.max(1, Math.round(scene.duration * fps) + (startFrame - from));
          lead = (startFrame - from) / fps;
          for (const word of scene.words || []) spoken.push({ start: scene.start + word.start, end: scene.start + word.end });
          moods.push({ start: scene.start, mood: scene.mood || 'neutral' });
        } else {
          durationFrames = Math.max(1, Math.round(scene.duration * fps));
          // Scenes overlap by one fade so the cross-dissolve never dips to black.
          from = Math.max(0, cursor - (index === 0 ? 0 : fadeFrames));
          cursor = from + durationFrames;
          for (const word of scene.words || []) spoken.push({ start: from / fps + word.start, end: from / fps + word.end });
          moods.push({ start: from / fps, mood: scene.mood || 'neutral' });
        }
        return (
          <Sequence key={index} from={from} durationInFrames={durationFrames}>
            <Scene scene={scene} index={index} fadeFrames={fadeFrames} durationFrames={durationFrames} hasMascot={Boolean(mascotFile)} lead={lead} />
          </Sequence>
        );
      })}
      {mascotFile ? <Mascot src={mascotFile} envelope={mouthEnvelope} words={spoken} moods={moods} /> : null}
      {audioFile ? <Audio src={staticFile(audioFile)} /> : null}
    </AbsoluteFill>
  );
};
