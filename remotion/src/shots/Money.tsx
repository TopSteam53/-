import React from 'react';
import { AbsoluteFill, interpolate, random, useCurrentFrame } from 'remotion';
import { Cat } from '../components/Cat';
import { Burst, Grid, Rays } from '../components/Fx';
import { clamp, COLORS, ease, FONT, pop, stroke } from '../lib';
import type { ShotCtx } from '../types';

const Big: React.FC<{ children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties }> = ({ children, size = 220, color = COLORS.yellow, style }) => (
  <div style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: size, color, ...stroke(16), textShadow: '0 16px 0 #000', whiteSpace: 'nowrap', lineHeight: 1, ...style }}>{children}</div>
);

export const Money: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const mode = ctx.shot.props?.mode || 'question';

  if (mode === 'question') {
    const glyphs = '0123456789';
    const slot = (i: number) => (frame < 14 + i * 5 ? glyphs[Math.floor(random(`sl${i}${frame}`) * 10)] : '?');
    return (
      <AbsoluteFill>
        <Rays c1="#2B1E00" c2="#3D2B00" speed={0.6} />
        <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 38%, rgba(255,210,63,0.35), rgba(0,0,0,0.75) 70%)' }} />
        <div style={{ position: 'absolute', top: 470, width: '100%', display: 'flex', justifyContent: 'center', gap: 22, transform: `scale(${pop(frame, 0, 9)})` }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: 210, height: 290, borderRadius: 36, background: 'linear-gradient(#fff,#E8E2FF)', border: '8px solid #000', display: 'grid', placeItems: 'center', boxShadow: '0 16px 0 #000' }}>
              <span style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: 190, color: '#1B1636' }}>{slot(i)}</span>
            </div>
          ))}
          <Big size={230} style={{ alignSelf: 'center', marginLeft: 16 }}>₽</Big>
        </div>
        <Burst at={2} x={540} y={620} n={22} items={['🪙', '💰', '🪙', '✨']} seed={31} spread={760} size={80} />
      </AbsoluteFill>
    );
  }

  if (mode === 'zero') {
    const v = Math.round(ease(frame, 0, 16, 99999, 0));
    const done = frame >= 16;
    const gray = ease(frame, 14, 24, 0, 1);
    return (
      <AbsoluteFill>
        <AbsoluteFill style={{ background: `linear-gradient(${done ? '#20243A' : '#2A1F5C'}, #0B0C16)` }}><Grid /></AbsoluteFill>
        <div style={{ position: 'absolute', top: 360, width: '100%', display: 'flex', justifyContent: 'center', transform: `scale(${done ? 1 + 0.18 * Math.exp(-(frame - 16) / 4) : 1})`, filter: `saturate(${1 - gray * 0.7})` }}>
          <Big size={v > 999 ? 200 : 290} color={done ? '#FFFFFF' : COLORS.yellow}>{v.toLocaleString('ru-RU')} ₽</Big>
        </div>
        {done && (
          <div style={{ position: 'absolute', top: 690, width: '100%', textAlign: 'center', fontFamily: FONT.body, fontWeight: 800, fontSize: 52, color: '#9AA3C7', opacity: ease(frame, 18, 24, 0, 1) }}>
            (пока что)
          </div>
        )}
        <div style={{ position: 'absolute', left: 540 - 170, top: 780, transform: `translateY(${ease(frame, 14, 24, 700, 0)}px) rotate(${Math.sin(frame / 5) * 4}deg)` }}>
          <Cat size={340} body="#A8B3C7" ear="#FF9FBF" mood="cry" />
        </div>
      </AbsoluteFill>
    );
  }

  // chart
  const draw = ease(frame, 0, Math.max(10, ctx.dur - 12), 0, 1);
  const pts = Array.from({ length: 9 }, (_, i) => [140 + i * 88, 950 - i * 44 - Math.sin(i * 1.7) * 60]);
  const n = Math.max(1, Math.floor(draw * (pts.length - 1)) + 1);
  const d = pts.slice(0, n).map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
  const last = pts[n - 1];
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 40%, #173A2E, #08110E 75%)' }}><Grid color="rgba(53,242,176,0.07)" /></AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: 'absolute' }}>
        <line x1={120} y1={1000} x2={930} y2={1000} stroke="#fff" strokeWidth={6} />
        <line x1={120} y1={1000} x2={120} y2={320} stroke="#fff" strokeWidth={6} />
        <path d={d} stroke={COLORS.mint} strokeWidth={16} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', left: 150, top: 300, fontFamily: FONT.title, fontWeight: 900, fontSize: 48, color: '#fff', ...stroke(6) }}>доход, ₽</div>
      <div style={{ position: 'absolute', left: last[0], top: last[1], transform: `translate(-50%,-110%) scale(${1 + 0.08 * Math.sin(frame / 3)})` }}>
        <Big size={200} color={COLORS.mint}>?</Big>
      </div>
    </AbsoluteFill>
  );
};
