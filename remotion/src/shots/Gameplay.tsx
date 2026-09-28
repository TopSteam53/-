import React from 'react';
import { AbsoluteFill, interpolate, OffthreadVideo, staticFile, useCurrentFrame, Easing } from 'remotion';
import { Burst, Floaters, Vignette } from '../components/Fx';
import { clamp, FPS } from '../lib';
import type { ShotCtx } from '../types';

export const clipSrc = (clip: string) => staticFile(`_build/footage/${clip}.mp4`);

export const GameVideo: React.FC<{ clip: string; from?: number; style?: React.CSSProperties }> = ({ clip, from = 0, style }) => (
  <OffthreadVideo src={clipSrc(clip)} trimBefore={Math.round(from * FPS)} muted
    style={{ width: '100%', height: '100%', objectFit: 'cover', ...style }} />
);

export const Gameplay: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const p = ctx.shot.props || {};
  const [z0, z1] = p.zoom || [1, 1.1];
  const z = interpolate(frame, [0, ctx.dur], [z0, z1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const fy = (p.focusY ?? 0.5) * 100;
  const rot = p.hypno ? Math.sin(frame / 14) * 1.5 : 0;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <AbsoluteFill style={{ transform: `scale(${z}) rotate(${rot}deg)`, transformOrigin: `50% ${fy}%` }}>
        <GameVideo clip={p.clip} from={p.from} />
      </AbsoluteFill>
      {p.dim ? <AbsoluteFill style={{ background: `rgba(10,6,30,${p.dim})` }} /> : null}
      {p.sparkles && <Burst at={2} x={540} y={900} n={22} items={['✨', '⭐', '💫']} seed={ctx.shot.idx} />}
      {p.hearts && <Floaters items={['💖', '💕', '✨', '🐾']} n={14} seed={ctx.shot.idx} />}
      <Vignette strength={0.45} />
    </AbsoluteFill>
  );
};
