import '@fontsource/unbounded/cyrillic-900.css';
import '@fontsource/unbounded/latin-900.css';
import '@fontsource/montserrat/cyrillic-600.css';
import '@fontsource/montserrat/cyrillic-700.css';
import '@fontsource/montserrat/cyrillic-800.css';
import '@fontsource/montserrat/cyrillic-900.css';
import '@fontsource/montserrat/latin-600.css';
import '@fontsource/montserrat/latin-700.css';
import '@fontsource/montserrat/latin-800.css';
import '@fontsource/montserrat/latin-900.css';
import '@fontsource/jetbrains-mono/cyrillic-400.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import React from 'react';
import { Composition, continueRender, delayRender, staticFile } from 'remotion';
import { Main } from './Main';
import { MascotSheet } from './MascotSheet';
import { MascotTalk } from './MascotTalk';
import type { Timeline } from './types';

const fontHandle = typeof document !== 'undefined' ? delayRender('fonts') : null;
if (typeof document !== 'undefined') {
  Promise.all([
    document.fonts.load('900 100px Unbounded', 'АБВ abc'),
    document.fonts.load('900 100px Montserrat', 'АБВ abc'),
    document.fonts.load('800 100px Montserrat', 'АБВ abc'),
    document.fonts.load('700 100px Montserrat', 'АБВ abc'),
    document.fonts.load('600 100px Montserrat', 'АБВ abc'),
    document.fonts.load('400 30px "JetBrains Mono"', 'АБВ abc'),
  ]).then(() => continueRender(fontHandle!)).catch(() => continueRender(fontHandle!));
}

export const Root: React.FC = () => (
  <>
  <Composition
    id="MascotTalk"
    component={MascotTalk as any}
    fps={30}
    width={1920}
    height={1080}
    durationInFrames={300}
    defaultProps={{ timeline: null as unknown as Timeline }}
    calculateMetadata={async ({ props }) => {
      let timeline = props.timeline as Timeline | null;
      if (!timeline) timeline = await (await fetch(staticFile('_build/timeline.json'))).json();
      return { durationInFrames: Math.ceil(timeline!.duration * 30), props: { timeline } };
    }}
  />
  <Composition id="MascotSheet" component={MascotSheet} fps={30} width={1920} height={1080} durationInFrames={60} />
  <Composition
    id="Main"
    component={Main as any}
    fps={30}
    width={1080}
    height={1920}
    durationInFrames={300}
    defaultProps={{ timeline: null as unknown as Timeline }}
    calculateMetadata={async ({ props }) => {
      let timeline = props.timeline as Timeline | null;
      if (!timeline) timeline = await (await fetch(staticFile('_build/timeline.json'))).json();
      return { durationInFrames: Math.ceil(timeline!.duration * 30), props: { timeline } };
    }}
  />
  </>
);
