import React from 'react';
import { AbsoluteFill, interpolate, random, useCurrentFrame } from 'remotion';
import { Cat, CAT_COLORS } from '../components/Cat';
import { Burst, Confetti, Floaters, GlitchBars, Grid, Rays, Stamp, Vignette } from '../components/Fx';
import { clamp, COLORS, ease, FONT, pop, stroke } from '../lib';
import type { ShotCtx } from '../types';
import { GameVideo } from './Gameplay';

const Slam: React.FC<{ at: number; frame: number; children: React.ReactNode; size: number; color?: string; rot?: number }> = ({ at, frame, children, size, color = '#fff', rot = 0 }) => {
  if (frame < at) return <div style={{ height: size * 1.05 }} />;
  const s = interpolate(frame - at, [0, 4, 7], [2.4, 0.94, 1], clamp);
  return (
    <div style={{ transform: `scale(${s}) rotate(${rot}deg)`, fontFamily: FONT.title, fontWeight: 900, fontSize: size, color, lineHeight: 1.05, ...stroke(size * 0.1), textShadow: `0 ${size * 0.09}px 0 #000`, whiteSpace: 'nowrap' }}>
      {children}
    </div>
  );
};

export const Title: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const p = ctx.shot.props || {};
  const ep = ctx.tl.episode;
  if (p.kind === 'game') {
    const letters = (ep.gameName || 'ИГРА').split('');
    const palette = [COLORS.yellow, COLORS.pink, COLORS.mint, COLORS.blue, COLORS.orange, COLORS.purple];
    return (
      <AbsoluteFill>
        <AbsoluteFill style={{ filter: 'blur(14px) brightness(0.55)', transform: 'scale(1.15)' }}>
          <GameVideo clip={p.clip || 'gameplay_main'} from={p.from || 0} />
        </AbsoluteFill>
        <Floaters items={['✨', '🐾', '💖', '⭐']} n={14} seed={9} />
        <div style={{ position: 'absolute', top: 330, width: '100%', display: 'flex', justifyContent: 'center', transform: `translateY(${ease(frame, 4, 14, -500, 0)}px)` }}>
          <Cat size={330} body="#F7D774" ear="#FF9FB5" crown mood="happy" blink={frame % 45 > 40} />
        </div>
        <div style={{ position: 'absolute', top: 720, width: '100%', display: 'flex', justifyContent: 'center' }}>
          {letters.map((ch: string, i: number) => {
            const at = i * 2;
            const s = pop(frame, at, 9);
            const bob = Math.sin((frame - at) / 5 + i) * 10;
            return (
              <span key={i} style={{
                display: 'inline-block', transform: `translateY(${bob}px) scale(${s}) rotate(${(i % 2 ? 5 : -5)}deg)`,
                fontFamily: FONT.title, fontWeight: 900, fontSize: letters.length > 7 ? 104 : 122, margin: '0 -2px', color: palette[i % palette.length],
                ...stroke(18), textShadow: '0 16px 0 #000',
              }}>{ch}</span>
            );
          })}
        </div>
        <Burst at={3} x={540} y={820} n={26} items={['✨', '⭐', '💫', '🐾']} seed={13} spread={800} size={70} />
      </AbsoluteFill>
    );
  }
  // series title
  return (
    <AbsoluteFill>
      <Rays c1="#5B2BD6" c2="#7A3CF0" speed={0.5} />
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 45%, rgba(255,79,154,0.35), rgba(14,11,31,0.85) 70%)' }} />
      <div style={{ position: 'absolute', top: 420, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <Slam at={0} frame={frame} size={150} rot={-3}>С НУЛЯ</Slam>
        <Slam at={4} frame={frame} size={120} color={COLORS.yellow} rot={2}>ДО</Slam>
        <Slam at={8} frame={frame} size={112} color={COLORS.mint} rot={-2}>РЕЗУЛЬТАТА</Slam>
      </div>
      {frame >= 14 && (
        <div style={{
          position: 'absolute', top: 960, left: '50%', transform: `translateX(-50%) scale(${pop(frame, 14, 8)}) rotate(-4deg)`,
          background: COLORS.pink, color: '#fff', fontFamily: FONT.title, fontWeight: 900, fontSize: 54, padding: '14px 40px', borderRadius: 20,
          border: '6px solid #000', boxShadow: '0 10px 0 #000',
        }}>ЭПИЗОД {ep.episodeNumber}</div>
      )}
      <Confetti at={1} />
      <Vignette strength={0.5} />
    </AbsoluteFill>
  );
};

export const Subscribe: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const click = Math.max(8, ctx.wordFrame(1));
  const done = frame >= click + 2;
  const cx = ease(frame, 0, click, 1000, 640);
  const cy = ease(frame, 0, click, 1500, 1000);
  const press = interpolate(frame - click, [0, 2, 5], [1, 0.9, 1], clamp);
  const ep = ctx.tl.episode;
  return (
    <AbsoluteFill>
      <Rays c1="#FF4F9A" c2="#FF6FAF" speed={0.35} />
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 40%, rgba(255,255,255,0.25), rgba(60,10,50,0.7) 75%)' }} />
      <div style={{ position: 'absolute', top: 300, width: '100%', display: 'flex', justifyContent: 'center', transform: `scale(${pop(frame, 0, 9)})` }}>
        <Cat size={360} body="#FFB35C" ear="#FF8FB1" mood={done ? 'love' : 'happy'} />
      </div>
      <div style={{ position: 'absolute', top: 690, width: '100%', textAlign: 'center', fontFamily: FONT.title, fontWeight: 900, fontSize: 58, color: '#fff', ...stroke(8), textShadow: '0 8px 0 #000' }}>
        {ep.series}
      </div>
      <div style={{
        position: 'absolute', top: 810, left: '50%', transform: `translateX(-50%) scale(${pop(frame, 3, 8) * press})`,
        background: done ? '#2E2A40' : '#FE2C55', color: '#fff', fontFamily: FONT.body, fontWeight: 900, fontSize: 64,
        padding: '34px 70px', borderRadius: 30, whiteSpace: 'nowrap', boxShadow: '0 12px 0 rgba(0,0,0,0.6)', border: '5px solid #000',
      }}>{done ? '✓ ВЫ ПОДПИСАНЫ' : '+ ПОДПИСАТЬСЯ'}</div>
      <div style={{ position: 'absolute', left: cx, top: cy, fontSize: 110, transform: `scale(${press})`, fontFamily: FONT.emoji, filter: 'drop-shadow(0 8px 6px rgba(0,0,0,0.5))' }}>👆</div>
      <Burst at={click + 2} x={540} y={880} n={26} items={['💖', '💕', '✨', '🐾']} seed={41} spread={800} size={70} />
      {done && <div style={{ position: 'absolute', left: 820, top: 330, fontSize: 120, fontFamily: FONT.emoji, transform: `rotate(${Math.sin(frame / 2) * 18}deg)` }}>🔔</div>}
    </AbsoluteFill>
  );
};

export const Teaser: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const p = ctx.shot.props || {};
  const dots = '.'.repeat(1 + (Math.floor(frame / 8) % 3));
  return (
    <AbsoluteFill style={{ background: '#07060F' }}>
      <Grid color="rgba(255,59,78,0.08)" />
      <AbsoluteFill style={{ background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0 2px, transparent 2px 6px)' }} />
      <div style={{ position: 'absolute', top: 290, width: '100%', textAlign: 'center', fontFamily: FONT.body, fontWeight: 800, fontSize: 42, letterSpacing: 8, color: '#9A94C0', opacity: ease(frame, 0, 6, 0, 1) }}>
        СЛЕДУЮЩИЙ ЭПИЗОД
      </div>
      <div style={{ position: 'absolute', top: 370, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <Slam at={2} frame={frame} size={120} color={COLORS.yellow}>ЭПИЗОД {p.episode}</Slam>
        <div style={{ position: 'relative' }}>
          <Slam at={7} frame={frame} size={104} color={COLORS.red}>{p.title}</Slam>
          {frame % 23 < 3 && frame > 8 && <div style={{ position: 'absolute', inset: 0, transform: `translateX(${(random(`t${frame}`) - 0.5) * 40}px)`, mixBlendMode: 'screen', opacity: 0.8 }}><Slam at={0} frame={99} size={104} color={COLORS.blue}>{p.title}</Slam></div>}
        </div>
      </div>
      <div style={{ position: 'absolute', top: 730, width: '100%', display: 'flex', justifyContent: 'center', gap: 6 }}>
        {CAT_COLORS.slice(0, 4).map(([b, e], i) => (
          <div key={i} style={{ transform: `translateY(${Math.abs(Math.sin((frame + i * 6) / 5)) * -26}px) scale(${pop(frame, 10 + i * 3, 8)})` }}>
            <Cat size={200} body={b} ear={e} mood={i === 3 ? 'shock' : 'happy'} />
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', top: 960, width: '100%', textAlign: 'center', fontFamily: FONT.body, fontWeight: 800, fontSize: 48, color: '#fff' }}>
        ⏳ На проверке{dots}
      </div>
      {frame < 8 && <GlitchBars seed={frame + 500} />}
    </AbsoluteFill>
  );
};

export const Verdict: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const hit = ctx.tl.musicInfo?.final_hit;
  const stopAt = hit ? Math.max(12, Math.round(hit * 30) - Math.round(ctx.shot.start * 30)) : Math.max(12, ctx.dur - 34);
  // flicker gets slower, then stops on "?"
  let k = 0, acc = 0, step = 3;
  while (acc + step <= frame && acc < stopAt) { acc += step; k++; step = Math.min(9, step + 0.6); }
  const final = frame >= stopAt;
  const ok = k % 2 === 0;
  return (
    <AbsoluteFill style={{ background: final ? '#0E0B1F' : ok ? '#0B2A1E' : '#2A0B12' }}>
      <Grid />
      {!final && (
        <Stamp key={k} at={acc} text={ok ? 'ОДОБРЕНО' : 'ОТКЛОНЕНО'} color={ok ? COLORS.mint : COLORS.red} x={530} y={640} rot={ok ? -8 : 7} size={112} instant />
      )}
      {final && (
        <>
          <div style={{ position: 'absolute', top: 330, width: '100%', textAlign: 'center', transform: `scale(${pop(frame, stopAt, 9) * (1 + 0.04 * Math.sin(frame / 4))})` }}>
            <span style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: 480, color: COLORS.yellow, ...stroke(26), textShadow: '0 22px 0 #000', lineHeight: 1 }}>?</span>
          </div>
          <div style={{ position: 'absolute', top: 900, width: '100%', textAlign: 'center', fontFamily: FONT.title, fontWeight: 900, fontSize: 50, color: '#fff', opacity: ease(frame, stopAt + 6, stopAt + 12, 0, 1), ...stroke(6) }}>
            УЗНАЕМ В ЭПИЗОДЕ 2
          </div>
        </>
      )}
      <Vignette strength={0.6} />
    </AbsoluteFill>
  );
};
