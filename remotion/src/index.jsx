import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { LumenVideo } from './LumenVideo.jsx';
import { InfoVideo } from './InfoVideo.jsx';
import { Thumbnail } from './Thumbnail.jsx';

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

const infoDefaults = {
  durationInSeconds: 6, audioFile: null, mascotFile: null, mouthEnvelope: [], phrases: [],
  scenes: [{ start: 0, duration: 6, template: 'glass_ice', headline: 'Vì sao đá nổi?', subtitle: 'Trên mặt nước', mood: 'curious' }]
};

const Root = () => (
  <>
    <Composition
      id="InfoVideo"
      component={InfoVideo}
      fps={FPS}
      width={1080}
      height={1920}
      durationInFrames={FPS * 6}
      defaultProps={infoDefaults}
      calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, Math.round(props.durationInSeconds * FPS)) })}
    />
    <Composition id="Thumbnail" component={Thumbnail} fps={FPS} width={1280} height={720} durationInFrames={1} defaultProps={{}} />
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
  </>
);

registerRoot(Root);
