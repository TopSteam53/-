import React from 'react';
import { AbsoluteFill, interpolate, random, useCurrentFrame } from 'remotion';
import { clamp, COLORS, FONT, H, shakeXY, W } from '../lib';

/** Applies in-transition effects to a shot. frame is local to the shot. */
export const ShotFx: React.FC<{ fx: string[]; seed: number; children: React.ReactNode }> = ({ fx, seed, children }) => {
  const frame = useCurrentFrame();
  let transform = '';
  let filter = '';
  if (fx.includes('punch')) {
    const s = 1 + 0.16 * Math.exp(-frame / 3.2);
    transform += ` scale(${s})`;
  }
  if (fx.includes('whip')) {
    const t = interpolate(frame, [0, 6], [1, 0], clamp);
    const dir = seed % 2 === 0 ? 1 : -1;
    transform += ` translateX(${dir * t * t * W * 0.9}px) skewX(${dir * -t * 12}deg)`;
    if (t > 0) filter += ` blur(${t * 26}px)`;
  }
  if (fx.includes('shake')) {
    const [x, y] = shakeXY(frame, 0, 14, 38, seed);
    transform += ` translate(${x}px, ${y}px) rotate(${x * 0.04}deg)`;
  }
  let glitch: React.ReactNode = null;
  if (fx.includes('glitch') && frame < 9) {
    const j = (random(`gj${seed}${frame}`) - 0.5) * 60;
    transform += ` translateX(${j}px)`;
    filter += ` hue-rotate(${random(`gh${seed}${frame}`) * 360}deg) saturate(2.2) contrast(1.4)`;
    glitch = <GlitchBars seed={seed * 100 + frame} />;
  }
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform, filter: filter || undefined }}>{children}</AbsoluteFill>
      {glitch}
      {fx.includes('flash') && <Flash at={0} />}
    </AbsoluteFill>
  );
};

export const Flash: React.FC<{ at: number; color?: string; dur?: number }> = ({ at, color = '#fff', dur = 7 }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame - at, [0, 1, dur], [0, 0.9, 0], clamp);
  if (o <= 0) return null;
  return <AbsoluteFill style={{ background: color, opacity: o, mixBlendMode: 'screen' }} />;
};

export const GlitchBars: React.FC<{ seed: number }> = ({ seed }) => {
  const bars = Array.from({ length: 9 }, (_, i) => {
    const y = random(`by${seed}${i}`) * H;
    const h = 8 + random(`bh${seed}${i}`) * 70;
    const x = (random(`bx${seed}${i}`) - 0.5) * 300;
    const c = [COLORS.pink, COLORS.mint, COLORS.blue, '#fff'][i % 4];
    return (
      <div key={i} style={{ position: 'absolute', left: x, top: y, width: W * 1.3, height: h, background: c, opacity: 0.55, mixBlendMode: 'screen' }} />
    );
  });
  return <AbsoluteFill style={{ pointerEvents: 'none' }}>{bars}</AbsoluteFill>;
};

/** Burst of particles (emoji or dots) from a point. */
export const Burst: React.FC<{
  at: number; x: number; y: number; n?: number; items?: string[]; spread?: number; seed?: number; size?: number; gravity?: number; dur?: number;
}> = ({ at, x, y, n = 18, items = ['✨'], spread = 520, seed = 1, size = 56, gravity = 1400, dur = 30 }) => {
  const frame = useCurrentFrame();
  const t = (frame - at) / 30;
  if (t < 0 || frame - at > dur) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: n }, (_, i) => {
        const a = random(`a${seed}${i}`) * Math.PI * 2;
        const v = spread * (0.45 + random(`v${seed}${i}`) * 0.75);
        const px = x + Math.cos(a) * v * t;
        const py = y + Math.sin(a) * v * t - 300 * t + (gravity * t * t) / 2;
        const o = interpolate(frame - at, [0, dur * 0.6, dur], [1, 1, 0], clamp);
        const s = size * (0.6 + random(`s${seed}${i}`) * 0.8);
        const item = items[i % items.length];
        const isDot = item.startsWith('#');
        return (
          <div key={i} style={{
            position: 'absolute', left: px - s / 2, top: py - s / 2, width: s, height: s, opacity: o,
            fontSize: s, lineHeight: 1, fontFamily: FONT.emoji,
            transform: `rotate(${t * 400 * (random(`r${seed}${i}`) - 0.5)}deg)`,
            ...(isDot ? { background: item, borderRadius: i % 3 === 0 ? 4 : '50%', width: s * 0.45, height: s * (i % 3 === 0 ? 0.8 : 0.45) } : {}),
          }}>{isDot ? null : item}</div>
        );
      })}
    </AbsoluteFill>
  );
};

export const Confetti: React.FC<{ at: number; seed?: number }> = ({ at, seed = 3 }) => (
  <>
    <Burst at={at} x={W * 0.2} y={H * 0.45} n={34} seed={seed} spread={900} size={44} gravity={1800} dur={45}
      items={[COLORS.yellow, COLORS.pink, COLORS.mint, COLORS.blue, COLORS.orange, COLORS.purple]} />
    <Burst at={at} x={W * 0.8} y={H * 0.45} n={34} seed={seed + 7} spread={900} size={44} gravity={1800} dur={45}
      items={[COLORS.pink, COLORS.yellow, COLORS.blue, COLORS.mint, COLORS.purple, COLORS.orange]} />
  </>
);

/** Floating sparkles/hearts rising continuously (ambient). */
export const Floaters: React.FC<{ items?: string[]; n?: number; seed?: number; size?: number }> = ({ items = ['✨'], n = 12, seed = 5, size = 60 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: n }, (_, i) => {
        const period = 50 + random(`p${seed}${i}`) * 40;
        const ph = ((frame + random(`o${seed}${i}`) * period) % period) / period;
        const x = 80 + random(`x${seed}${i}`) * (W - 260);
        const y = H * 0.75 - ph * H * 0.55;
        const o = Math.sin(ph * Math.PI);
        const s = size * (0.6 + random(`s${seed}${i}`) * 0.7);
        return (
          <div key={i} style={{ position: 'absolute', left: x + Math.sin(ph * 6 + i) * 30, top: y, fontSize: s, opacity: o, fontFamily: FONT.emoji, transform: `scale(${0.6 + o * 0.5})` }}>
            {items[i % items.length]}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** Rubber stamp that slams in. */
export const Stamp: React.FC<{ at: number; text: string; color: string; x: number; y: number; rot?: number; size?: number; instant?: boolean }> = ({ at, text, color, x, y, rot = -12, size = 110, instant }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const s = instant ? interpolate(frame - at, [0, 2], [1.25, 1], clamp) : interpolate(frame - at, [0, 5, 8], [2.6, 0.92, 1], clamp);
  const o = instant ? 1 : interpolate(frame - at, [0, 3], [0, 1], clamp);
  return (
    <div style={{
      position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${s})`, opacity: o,
      border: `12px solid ${color}`, borderRadius: 26, padding: '14px 40px', color, fontFamily: FONT.title, fontWeight: 900,
      fontSize: size, letterSpacing: 2, whiteSpace: 'nowrap', background: 'rgba(255,255,255,0.06)',
      boxShadow: `0 0 40px ${color}55`, textShadow: `0 0 20px ${color}66`,
    }}>{text}</div>
  );
};

export const Vignette: React.FC<{ strength?: number; color?: string }> = ({ strength = 0.55, color = '0,0,0' }) => (
  <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 45%, rgba(${color},0) 55%, rgba(${color},${strength}) 100%)`, pointerEvents: 'none' }} />
);

/** Animated rays background */
export const Rays: React.FC<{ c1: string; c2: string; speed?: number }> = ({ c1, c2, speed = 0.4 }) => {
  const frame = useCurrentFrame();
  const stops = Array.from({ length: 24 }, (_, i) => `${i % 2 ? c1 : c2} ${i * 15}deg ${(i + 1) * 15}deg`).join(',');
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: -W, top: -H * 0.5, width: W * 3, height: H * 2, background: `conic-gradient(from ${frame * speed}deg at 50% 50%, ${stops})` }} />
    </AbsoluteFill>
  );
};

export const Grid: React.FC<{ color?: string }> = ({ color = 'rgba(255,255,255,0.05)' }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{
      backgroundImage: `linear-gradient(${color} 2px, transparent 2px), linear-gradient(90deg, ${color} 2px, transparent 2px)`,
      backgroundSize: '90px 90px', backgroundPosition: `0 ${frame * 1.5}px`,
    }} />
  );
};
