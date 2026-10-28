import React, { useEffect, useMemo, useState } from 'react';
import { cancelRender, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { renderSvg, VIEW_WIDTH, VIEW_HEIGHT } from './mascot-svg.js';

export const Mascot = ({ src, envelope = [], words = [], moods = [], height = 600, right = 36, bottom = 18, instant = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [source, setSource] = useState(null);
  const [handle] = useState(() => delayRender('Loading mascot SVG'));

  useEffect(() => {
    fetch(staticFile(src))
      .then(response => response.text())
      .then(text => { setSource(text); continueRender(handle); })
      .catch(error => cancelRender(error));
  }, [src, handle]);

  const seconds = frame / fps;
  let mouthOpen = 0;
  if (envelope.length) {
    // Average a few frames around now so the jaw moves smoothly instead of flickering.
    const at = index => envelope[Math.min(envelope.length - 1, Math.max(0, index))] || 0;
    mouthOpen = Math.min(1, (at(frame - 1) + at(frame) * 2 + at(frame + 1)) / 4 * 1.25);
  } else {
    const speaking = words.find(word => seconds >= word.start && seconds < word.end);
    mouthOpen = speaking
      ? Math.abs(Math.sin(((seconds - speaking.start) / Math.max(0.12, speaking.end - speaking.start)) * Math.PI * 1.5))
      : 0;
  }

  let current = { start: 0, mood: 'neutral' };
  for (const entry of moods) if (entry.start <= seconds + 0.001) current = entry;
  const moodAge = Math.max(0, seconds - current.start);

  const entrance = instant ? 1 : spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const bob = instant ? 0 : Math.sin(seconds * 2.2) * 9;
  const sway = Math.sin(seconds * 1.1) * 1.2;
  const html = useMemo(
    () => (source ? renderSvg(source, { seconds, mouthOpen, mood: current.mood, moodAge }) : ''),
    [source, seconds, mouthOpen, current.mood, moodAge]
  );
  if (!source) return null;
  const width = Math.round((height * VIEW_WIDTH) / VIEW_HEIGHT);
  return (
    <div
      style={{
        position: 'absolute', right, bottom, width, height,
        opacity: interpolate(entrance, [0, 1], [0, 1]),
        transform: `translateY(${(1 - entrance) * 220 + bob}px) rotate(${sway}deg)`,
        transformOrigin: '50% 100%', filter: 'drop-shadow(0 18px 28px rgba(0,0,0,0.45))'
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
