import React from 'react';
import { AbsoluteFill, interpolate, random, useCurrentFrame } from 'remotion';
import { Cat } from '../components/Cat';
import { clamp, COLORS, FONT, pop } from '../lib';
import type { ShotCtx } from '../types';
import { GameVideo } from './Gameplay';

const ERRORS = [
  '✖ Uncaught TypeError: cat.merge is not a function',
  '    at onCollide (game.js:42)',
  '✖ RangeError: Maximum call stack size exceeded',
  '✖ ReferenceError: ysdk is not defined',
  '✖ Cannot read properties of undefined (reading "tier")',
  '⚠ 99+ errors',
];

export const Bug: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const p = ctx.shot.props || {};
  const pulse = 0.25 + 0.2 * Math.abs(Math.sin(frame / 4));
  const jitter = frame % 11 < 2 ? (random(`bj${frame}`) - 0.5) * 30 : 0;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <AbsoluteFill style={{ transform: `scale(1.12) translateX(${jitter}px)`, filter: frame % 17 < 2 ? 'hue-rotate(120deg) saturate(3)' : undefined }}>
        <GameVideo clip={p.clip || 'gameplay_bug'} from={p.from || 0} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, rgba(255,0,40,0) 40%, rgba(255,0,40,${pulse}) 100%)` }} />
      <div style={{
        position: 'absolute', left: 40, right: 90, top: 330, borderRadius: 28, background: 'rgba(20,4,8,0.9)', border: `4px solid ${COLORS.red}`,
        padding: '22px 26px', fontFamily: FONT.mono, fontSize: 27, lineHeight: 1.45, color: '#FF8A94',
        transform: `translateY(${interpolate(frame, [0, 6], [-500, 0], clamp)}px)`, boxShadow: '0 20px 60px rgba(255,0,40,0.35)',
      }}>
        <div style={{ color: '#fff', fontWeight: 800, marginBottom: 8 }}>Console <span style={{ background: COLORS.red, borderRadius: 10, padding: '2px 12px', marginLeft: 10 }}>{Math.min(99, Math.floor(frame * 3.3))}</span></div>
        {ERRORS.map((e, i) => frame >= 3 + i * 4 && (
          <div key={i} style={{ whiteSpace: 'pre-wrap', background: i % 2 ? undefined : 'rgba(255,59,78,0.12)', color: e.startsWith('⚠') ? COLORS.yellow : undefined }}>{e}</div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 700, top: 800, transform: `scale(${pop(frame, 10, 8)}) rotate(${Math.sin(frame / 2) * 8}deg)` }}>
        <Cat size={230} body="#3A3550" ear="#FF7FA8" mood="shock" />
      </div>
    </AbsoluteFill>
  );
};
