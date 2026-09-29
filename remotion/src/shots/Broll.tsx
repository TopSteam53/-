import React from 'react';
import { AbsoluteFill, interpolate, random, useCurrentFrame, Easing } from 'remotion';
import { Burst, Grid, Vignette } from '../components/Fx';
import { clamp, COLORS, ease, FONT, H, pop, stroke, W } from '../lib';
import type { ShotCtx } from '../types';
import { GameVideo } from './Gameplay';

/* ---------- spinning gold coin (pseudo-3D) ---------- */
export const Coin: React.FC<{ size: number; spin: number; blur?: number }> = ({ size, spin, blur = 0 }) => {
  const sx = Math.cos(spin);
  const edge = Math.max(0.08, Math.abs(sx));
  return (
    <div style={{ width: size, height: size, position: 'relative', filter: blur ? `blur(${blur}px)` : undefined }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%', transform: `scaleX(${edge})`,
        background: sx > 0 ? 'radial-gradient(circle at 35% 30%, #FFF6B0, #FFD23F 45%, #E0A100 80%)' : 'radial-gradient(circle at 60% 30%, #FFE680, #E8B21C 50%, #B07A00 85%)',
        boxShadow: `inset 0 0 0 ${size * 0.07}px #C98B00, inset 0 0 0 ${size * 0.1}px #FFE680, 0 ${size * 0.06}px ${size * 0.12}px rgba(0,0,0,0.35)`,
        display: 'grid', placeItems: 'center', fontSize: size * 0.46, color: '#B07A00', fontWeight: 900, fontFamily: FONT.title,
      }}>{edge > 0.35 ? '🐾' : ''}</div>
    </div>
  );
};

/** Rain of 3D-ish coins with depth of field. */
export const CoinRainLayer: React.FC<{ n?: number; seed?: number; speed?: number }> = ({ n = 26, seed = 1, speed = 1 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: n }, (_, i) => {
        const depth = random(`d${seed}${i}`); // 0 far .. 1 near
        const size = 50 + depth * 170;
        const v = (6 + depth * 14) * speed;
        const y0 = random(`y${seed}${i}`) * (H + 400);
        const y = ((y0 + frame * v) % (H + 400)) - 300;
        const x = random(`x${seed}${i}`) * (W - size) + Math.sin(frame / 20 + i) * 20;
        const blur = depth > 0.85 ? (depth - 0.85) * 40 : depth < 0.25 ? (0.25 - depth) * 16 : 0;
        return (
          <div key={i} style={{ position: 'absolute', left: x, top: y, zIndex: Math.round(depth * 100), opacity: 0.55 + depth * 0.45 }}>
            <Coin size={size} spin={frame / (6 + random(`s${seed}${i}`) * 6) + i} blur={blur} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const CoinRain: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const p = ctx.shot.props || {};
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 40%, #4A2A00, #120A00 75%)' }}>
      {p.clip && (
        <AbsoluteFill style={{ filter: 'blur(16px) brightness(0.45) saturate(1.3)', transform: 'scale(1.2)' }}>
          <GameVideo clip={p.clip} from={p.from || 0} />
        </AbsoluteFill>
      )}
      <CoinRainLayer n={p.n || 26} seed={ctx.shot.idx} speed={p.speed || 1} />
      {p.text && (
        <div style={{ position: 'absolute', top: 640, width: '100%', textAlign: 'center', transform: `scale(${pop(frame, 2, 9)}) rotate(-3deg)`, zIndex: 200 }}>
          <span style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: p.size || 150, color: COLORS.yellow, ...stroke(16), textShadow: '0 14px 0 #000', whiteSpace: 'nowrap' }}>{p.text}</span>
          {p.icon && <div style={{ fontSize: 170, fontFamily: FONT.emoji, marginTop: 10 }}>{p.icon}</div>}
        </div>
      )}
      <Vignette strength={0.55} />
    </AbsoluteFill>
  );
};

/* ---------- 3D phone mockup with the real game on screen ---------- */
export const Phone: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const p = ctx.shot.props || {};
  const t = frame / Math.max(1, ctx.dur);
  const ry = interpolate(t, [0, 1], p.rotY || [-28, -10], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const rx = 10 + Math.sin(frame / 18) * 2;
  const float = Math.sin(frame / 14) * 14;
  const s = interpolate(frame, [0, 10], [0.85, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
  const PW = 600, PH = 1200;
  const tapAt = p.tap ? Math.max(0, ctx.wordFrame(p.tap.w ?? 0)) : -1;
  const tapT = frame - tapAt;
  return (
    <AbsoluteFill style={{ background: p.bg || 'radial-gradient(circle at 50% 35%, #3B2A7A, #0E0B1F 70%)' }}>
      <Grid />
      {p.coins && <CoinRainLayer n={14} seed={ctx.shot.idx + 50} speed={0.6} />}
      <AbsoluteFill style={{ perspective: 1800 }}>
        <div style={{
          position: 'absolute', left: (W - PW) / 2, top: 250 + float, width: PW, height: PH,
          transform: `scale(${s}) rotateX(${rx}deg) rotateY(${ry}deg)`, transformStyle: 'preserve-3d',
        }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 86, background: 'linear-gradient(135deg,#3A3550,#12101C)', boxShadow: '0 60px 120px rgba(0,0,0,0.6), inset 0 0 0 4px #5A5475' }} />
          <div style={{ position: 'absolute', inset: 18, borderRadius: 70, overflow: 'hidden', background: '#000' }}>
            <GameVideo clip={p.clip} from={p.from || 0} rate={p.rate} style={{ objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 35%)' }} />
            {p.tap && tapT >= 0 && tapT < 24 && (
              <div style={{
                position: 'absolute', left: `${p.tap.x * 100}%`, top: `${p.tap.y * 100}%`, width: 140, height: 140, marginLeft: -70, marginTop: -70,
                borderRadius: '50%', border: '8px solid #fff', opacity: interpolate(tapT, [0, 20], [1, 0], clamp),
                transform: `scale(${interpolate(tapT, [0, 20], [0.4, 1.6], clamp)})`, boxShadow: '0 0 30px rgba(255,255,255,0.8)',
              }} />
            )}
          </div>
          <div style={{ position: 'absolute', top: 34, left: PW / 2 - 70, width: 140, height: 38, borderRadius: 19, background: '#000' }} />
        </div>
      </AbsoluteFill>
      {p.label && (
        <div style={{
          position: 'absolute', top: 236, left: 40, transformOrigin: '0 50%', transform: `scale(${pop(frame, 6, 8)}) rotate(-3deg)`, zIndex: 300,
          background: COLORS.yellow, color: '#1B1636', fontFamily: FONT.title, fontWeight: 900, fontSize: 52, padding: '14px 36px',
          borderRadius: 20, border: '6px solid #000', boxShadow: '0 10px 0 #000', whiteSpace: 'nowrap',
        }}>{p.label}</div>
      )}
    </AbsoluteFill>
  );
};

/* ---------- huge word card ---------- */
export const BigText: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const p = ctx.shot.props || {};
  return (
    <AbsoluteFill style={{ background: p.bg || 'radial-gradient(circle at 50% 40%, #FF4F9A, #3B0A2A 75%)' }}>
      <Grid color="rgba(255,255,255,0.08)" />
      {p.coins && <CoinRainLayer n={18} seed={ctx.shot.idx} />}
      <div style={{ position: 'absolute', top: 380, width: '100%', textAlign: 'center', zIndex: 200 }}>
        <div style={{ fontSize: 230, fontFamily: FONT.emoji, transform: `scale(${pop(frame, 0, 9)}) rotate(${Math.sin(frame / 5) * 6}deg)` }}>{p.icon}</div>
        <div style={{ transform: `scale(${interpolate(frame, [2, 6, 9], [2.4, 0.94, 1], clamp)})`, opacity: frame >= 2 ? 1 : 0 }}>
          <span style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: p.size || 140, color: '#fff', ...stroke(16), textShadow: '0 14px 0 #000', whiteSpace: 'nowrap' }}>{p.text}</span>
        </div>
        {p.sub && <div style={{ marginTop: 26, fontFamily: FONT.body, fontWeight: 800, fontSize: 48, color: COLORS.yellow, opacity: ease(frame, 8, 14, 0, 1), ...stroke(6) }}>{p.sub}</div>}
      </div>
      <Burst at={3} x={540} y={700} n={20} items={['✨', '💰', '🪙']} seed={ctx.shot.idx} spread={800} size={70} />
    </AbsoluteFill>
  );
};

/* ---------- list of items revealed on words ---------- */
export const ListCard: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const p = ctx.shot.props || {};
  const items: { icon: string; t: string; s?: string; w: number; hi?: boolean }[] = p.items || [];
  return (
    <AbsoluteFill style={{ background: p.bg || 'radial-gradient(circle at 50% 25%, #2A1F5C, #0E0B1F 75%)' }}>
      <Grid />
      <div style={{ position: 'absolute', top: 290, width: '100%', textAlign: 'center', transform: `scale(${pop(frame, 0, 8)})` }}>
        <span style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: 66, color: COLORS.yellow, ...stroke(8), whiteSpace: 'nowrap' }}>{p.title}</span>
      </div>
      <div style={{ position: 'absolute', top: 420, left: 60, right: 110, display: 'flex', flexDirection: 'column', gap: 26 }}>
        {items.map((it, i) => {
          const at = it.w < 0 ? -30 : Math.max(0, ctx.wordFrame(it.w));
          if (frame < at) return null;
          const x = ease(frame, at, at + 7, -900, 0);
          const lit = it.hi && frame >= at;
          return (
            <div key={i} style={{
              transform: `translateX(${x}px) scale(${lit ? 1 + 0.05 * Math.sin((frame - at) / 4) : 1})`, display: 'flex', alignItems: 'center', gap: 26,
              background: lit ? '#FFF7D6' : 'rgba(255,255,255,0.94)', borderRadius: 32, padding: '22px 30px',
              border: lit ? `6px solid ${COLORS.yellow}` : '6px solid transparent', boxShadow: '0 12px 0 rgba(0,0,0,0.3)',
            }}>
              <div style={{ fontSize: 84, fontFamily: FONT.emoji, lineHeight: 1 }}>{it.icon}</div>
              <div>
                <div style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: 46, color: '#1B1636' }}>{it.t}</div>
                {it.s && <div style={{ fontFamily: FONT.body, fontWeight: 700, fontSize: 32, color: '#6E6890' }}>{it.s}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ---------- money flow diagram ---------- */
export const Flow: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const p = ctx.shot.props || {};
  const nodes: { icon: string; t: string; w: number }[] = p.nodes || [];
  const ys = nodes.map((_, i) => 330 + i * 290);
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 40%, #123B3A, #07110F 75%)' }}>
      <Grid color="rgba(53,242,176,0.07)" />
      {nodes.map((n, i) => {
        const at = n.w < 0 ? -30 : Math.max(0, ctx.wordFrame(n.w));
        if (frame < at) return null;
        const next = nodes[i + 1];
        const nextAt = next ? (next.w < 0 ? -30 : Math.max(0, ctx.wordFrame(next.w))) : 1e9;
        return (
          <React.Fragment key={i}>
            <div style={{ position: 'absolute', left: 150, right: 190, top: ys[i], height: 190, transform: `scale(${pop(frame, at, 8)})`,
              background: i === nodes.length - 1 ? COLORS.yellow : '#fff', borderRadius: 40, display: 'flex', alignItems: 'center', gap: 28, padding: '0 40px',
              boxShadow: '0 14px 0 rgba(0,0,0,0.35)', border: '6px solid #000' }}>
              <div style={{ fontSize: 100, fontFamily: FONT.emoji }}>{n.icon}</div>
              <div style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: 50, color: '#1B1636' }}>{n.t}</div>
            </div>
            {next && frame >= nextAt && Array.from({ length: 3 }, (_, k) => {
              const ph = ((frame - nextAt) / 18 + k / 3) % 1;
              return (
                <div key={k} style={{ position: 'absolute', left: 540 - 35 - 20, top: ys[i] + 190 + ph * 100 - 35, opacity: Math.sin(ph * Math.PI) }}>
                  <Coin size={70} spin={frame / 4 + k} />
                </div>
              );
            })}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

/* ---------- formula ---------- */
export const Formula: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const p = ctx.shot.props || {};
  const terms: { icon: string; t: string; w: number }[] = p.terms || [];
  const resAt = p.resultW != null ? Math.max(0, ctx.wordFrame(p.resultW)) + 6 : ctx.dur - 12;
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 40%, #2A1F5C, #0E0B1F 75%)' }}>
      <Grid />
      <div style={{ position: 'absolute', top: 290, width: '100%', textAlign: 'center' }}>
        <span style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: 62, color: COLORS.mint, ...stroke(8) }}>{p.title || 'ФОРМУЛА ДОХОДА'}</span>
      </div>
      <div style={{ position: 'absolute', top: 420, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        {terms.map((tm, i) => {
          const at = Math.max(0, ctx.wordFrame(tm.w));
          if (frame < at) return <div key={i} style={{ height: 150 }} />;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20, height: 150, transform: `scale(${pop(frame, at, 8)})` }}>
              {i > 0 && <span style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: 90, color: COLORS.pink, ...stroke(10) }}>×</span>}
              <span style={{ fontSize: 100, fontFamily: FONT.emoji }}>{tm.icon}</span>
              <span style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: 66, color: '#fff', ...stroke(8) }}>{tm.t}</span>
            </div>
          );
        })}
        {frame >= resAt && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 10, transform: `scale(${pop(frame, resAt, 9)})` }}>
            <span style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: 110, color: COLORS.yellow, ...stroke(12) }}>=</span>
            <span style={{ fontSize: 150, fontFamily: FONT.emoji }}>💰</span>
          </div>
        )}
      </div>
      {frame >= resAt && <Burst at={resAt} x={540} y={1000} n={20} items={['🪙', '✨', '💰']} seed={5} size={70} />}
    </AbsoluteFill>
  );
};
