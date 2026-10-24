import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { LumenVideo } from './LumenVideo.jsx';

const FPS = 30;

const defaultProps = {
  width: 1920,
  height: 1080,
  audioFile: null,
  mascotFile: 'mascot.svg',
  mouthEnvelope: [],
  durationInSeconds: 6,
  scenes: [
    { title: 'Lumen preview', body: 'Animated scenes, moving titles and smooth captions.', mood: 'curious', image: null, duration: 6, words: [] }
  ]
};

const Root = () => (
  <Composition
    id="LumenVideo"
    component={LumenVideo}
    fps={FPS}
    width={1920}
    height={1080}
    durationInFrames={FPS * 6}
    defaultProps={defaultProps}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.max(1, Math.round(props.durationInSeconds * FPS)),
      width: props.width,
      height: props.height
    })}
  />
);

registerRoot(Root);
