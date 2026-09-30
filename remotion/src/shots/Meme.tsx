import React from 'react';
import { AbsoluteFill, interpolate, random, useCurrentFrame, Easing } from 'remotion';
import { Cat, CAT_COLORS } from '../components/Cat';
import { Burst, Floaters, GlitchBars, Grid, Rays, Vignette } from '../components/Fx';
import { clamp, COLORS, ease, f, FONT, H, pop, shakeXY, stroke, W } from '../lib';
import type { ShotCtx, Timeline } from '../types';
import { GameVideo } from './Gameplay';
import { CoinRainLayer } from './Broll';

/* ---------- helpers ---------- */

/** frame of the whole video (Sequence frames are local) */
const useGlobal = (ctx: ShotCtx) => useCurrentFrame() + f(ctx.shot.start);

export const mouthAt = (tl: Timeline, gframe: number) => tl.mouth?.[gframe] ?? 0;

export const bleepActive = (tl: Timeline, t: number) =>
  tl.lines.some((l) => l.words.some((w) => w.bleep && t >= w.start - 0.02 && t < Math.min(w.end, w.start + 0.55) + 0.1));

/** Game clip cropped to a panel, centred on focus point. */
export const FocusVideo: React.FC<{ clip: string; from?: number; focus?: [number, number]; zoom?: number; w: number; h: number; rate?: number }> = ({ clip, from = 0, focus = [0.5, 0.5], zoom = 1, w, h, rate }) => {
  const vw = W * zoom * (w / W);
  const vh = H * zoom * (w / W);
  const x = Math.min(0, Math.max(w - vw, w / 2 - focus[0] * vw));
  const y = Math.min(0, Math.max(h - vh, h / 2 - focus[1] * vh));
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: x, top: y, width: vw, height: vh }}>
        <GameVideo clip={clip} from={from} rate={rate} />
      </div>
    </div>
  );
};

export const Censor: React.FC<{ x: number; y: number; w?: number }> = ({ x, y, w = 300 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{
      position: 'absolute', left: x - w / 2 + (random(`cx${frame}`) - 0.5) * 16, top: y + (random(`cy${frame}`) - 0.5) * 10, width: w, height: w * 0.3,
      background: '#000', transform: 'rotate(-6deg)', display: 'grid', placeItems: 'center', border: '5px solid #fff', zIndex: 500,
      boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
    }}>
      <span style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: w * 0.15, color: '#fff', letterSpacing: 2 }}>ПИ-И-ИП</span>
    </div>
  );
};

/* ---------- meme reaction zoom ("deep fried" punch-in) ---------- */
export const MemeZoom: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const g = useGlobal(ctx);
  const p = ctx.shot.props || {};
  const z = interpolate(frame, [0, 5, ctx.dur], [1, p.zoom || 1.9, (p.zoom || 1.9) * 1.08], { ...clamp, easing: Easing.out(Easing.cubic) });
  const [sx, sy] = shakeXY(frame, 4, 16, 34, ctx.shot.idx);
  const focus: [number, number] = p.focus || [0.5, 0.36];
  const fry = p.deepfry !== false;
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      <AbsoluteFill style={{
        transform: `translate(${sx}px, ${sy}px) scale(${z})`, transformOrigin: `${focus[0] * 100}% ${focus[1] * 100}%`,
        filter: fry ? 'saturate(2.6) contrast(1.55) brightness(1.08)' : undefined,
      }}>
        {p.clip ? <GameVideo clip={p.clip} from={p.from || 0} /> : (
          <AbsoluteFill style={{ background: p.bg || 'radial-gradient(circle at 50% 40%, #FF4F9A, #2A0B2A 75%)', display: 'grid', placeItems: 'center' }}>
            <span style={{ fontSize: 520, fontFamily: FONT.emoji, marginTop: -200 }}>{p.big || '💀'}</span>
          </AbsoluteFill>
        )}
      </AbsoluteFill>
      {p.emoji && (
        <div style={{ position: 'absolute', right: 110, top: 300, fontSize: 200, fontFamily: FONT.emoji, transform: `scale(${pop(frame, 3, 7)}) rotate(12deg)` }}>{p.emoji}</div>
      )}
      {p.text && (
        <div style={{ position: 'absolute', top: 370, left: 40, right: 110, textAlign: 'center', transform: `scale(${pop(frame, 2, 7)})` }}>
          <span style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: 74, lineHeight: 1.1, color: '#fff', ...stroke(12), textShadow: '0 10px 0 #000' }}>{p.text}</span>
        </div>
      )}
      <Vignette strength={0.7} />
    </AbsoluteFill>
  );
};

/* ---------- VS card ---------- */
export const Versus: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const g = useGlobal(ctx);
  const p = ctx.shot.props || {};
  const bAt = p.bW != null ? Math.max(0, ctx.wordFrame(p.bW)) : 8;
  const side = (s: any, top: boolean, at: number) => frame >= at && (
    <div style={{
      position: 'absolute', left: 60, right: 100, top: top ? 250 : 700, height: 380, borderRadius: 40, border: '7px solid #000',
      background: top ? 'linear-gradient(135deg,#FFE14D,#FF9A3C)' : 'linear-gradient(135deg,#8C5CFF,#4DA3FF)', boxShadow: '0 14px 0 #000',
      transform: `translateX(${ease(frame, at, at + 7, top ? -900 : 900, 0)}px)`, display: 'flex', alignItems: 'center', gap: 30, padding: '0 40px',
    }}>
      <div style={{ fontSize: 190, fontFamily: FONT.emoji, flexShrink: 0 }}>{s.icon}</div>
      <div>
        <div style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: 64, color: '#fff', ...stroke(10), lineHeight: 1.05 }}>{s.label}</div>
        {s.sub && <div style={{ fontFamily: FONT.body, fontWeight: 900, fontSize: 40, color: '#1B1636', marginTop: 10 }}>{s.sub}</div>}
      </div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: '#0E0B1F' }}>
      <Grid />
      {side(p.a, true, 0)}
      {side(p.b, false, bAt)}
      {frame >= bAt && (
        <div style={{ position: 'absolute', top: 580, width: '100%', textAlign: 'center', transform: `scale(${pop(frame, bAt + 3, 8)}) rotate(-8deg)`, zIndex: 10 }}>
          <span style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: 150, color: COLORS.red, ...stroke(16), textShadow: '0 12px 0 #000' }}>VS</span>
        </div>
      )}
    </AbsoluteFill>
  );
};

/* ---------- TikTok split: content on top, "retention" gameplay below ---------- */
export const SplitBrain: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const g = useGlobal(ctx);
  const p = ctx.shot.props || {};
  const split = 960;
  const slide = ease(frame, 0, 8, 960, 0);
  return (
    <AbsoluteFill style={{ background: '#0E0B1F' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: split, overflow: 'hidden', background: '#0E0B1F' }}>
        <FocusVideo clip={p.top.clip} from={p.top.from || 0} focus={p.top.focus || [0.5, 0.4]} zoom={p.top.zoom || 1.3} w={W} h={split} rate={p.top.rate} />
        {p.top.caption && (
          <div style={{ position: 'absolute', top: 250, width: '100%', textAlign: 'center', transform: `scale(${pop(frame, 2, 8)})` }}>
            <span style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: 60, color: COLORS.yellow, ...stroke(10) }}>{p.top.caption}</span>
          </div>
        )}
      </div>
      <div style={{ position: 'absolute', left: 0, top: split, width: W, height: H - split, overflow: 'hidden', transform: `translateY(${slide}px)` }}>
        <FocusVideo clip={p.bottom.clip} from={p.bottom.from || 0} focus={p.bottom.focus || [0.5, 0.5]} zoom={p.bottom.zoom || 1.15} w={W} h={H - split} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: split - 5, height: 10, background: '#000' }} />
      {frame >= 8 && (
        <div style={{
          position: 'absolute', left: 40, top: split + 30, transform: `scale(${pop(frame, 8, 8)}) rotate(-3deg)`, transformOrigin: '0 50%',
          background: COLORS.yellow, color: '#1B1636', fontFamily: FONT.title, fontWeight: 900, fontSize: 34, padding: '10px 22px', borderRadius: 16, border: '5px solid #000',
        }}>{p.label || '🧠 ГЕЙМПЛЕЙ ДЛЯ УДЕРЖАНИЯ'}</div>
      )}
    </AbsoluteFill>
  );
};

/* ---------- expectation / reality ---------- */
export const ExpectReality: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const g = useGlobal(ctx);
  const p = ctx.shot.props || {};
  const rAt = p.realityW == null ? 99999 : p.realityW < 0 ? -30 : Math.max(0, ctx.wordFrame(p.realityW));
  const cens = bleepActive(ctx.tl, g / 30);
  const panel = (s: any, top: number, h: number, label: string, color: string, at: number, children?: React.ReactNode) => (
    <div style={{ position: 'absolute', left: 50, right: 100, top, height: h, borderRadius: 36, overflow: 'hidden', border: `7px solid ${color}`, boxShadow: '0 14px 0 #000', background: '#111',
      transform: `scale(${at < 0 ? 1 : pop(frame, at, 8)})` }}>
      <FocusVideo clip={s.clip} from={s.from || 0} focus={s.focus || [0.5, 0.5]} zoom={s.zoom || 1.4} w={W - 150} h={h} />
      {children}
      <div style={{ position: 'absolute', left: 24, top: 20, background: color, color: '#fff', fontFamily: FONT.title, fontWeight: 900, fontSize: 46, padding: '8px 22px', borderRadius: 16, border: '5px solid #000', ...stroke(4) }}>{label}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: '#0E0B1F' }}>
      <Grid />
      {panel(p.top, 240, 620, 'ОЖИДАНИЕ', COLORS.mint, -1, <CoinRainLayer n={12} seed={4} speed={0.8} />)}
      {frame >= rAt
        ? panel(p.bottom, 900, 560, 'РЕАЛЬНОСТЬ', COLORS.red, rAt, frame > rAt + 6 ? <AbsoluteFill style={{ filter: 'saturate(0)', background: 'rgba(0,0,0,0.1)' }} /> : null)
        : (
          <div style={{ position: 'absolute', left: 50, right: 100, top: 900, height: 560, borderRadius: 36, border: '7px dashed #4A4290', display: 'grid', placeItems: 'center' }}>
            <span style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: 150, color: '#4A4290' }}>???</span>
          </div>
        )}
      {cens && <Censor x={540} y={1080} w={460} />}
    </AbsoluteFill>
  );
};

/* ---------- "author will show his face" teaser ---------- */
export const FaceTeaser: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const p = ctx.shot.props || {};
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 40%, #3A1440, #0E0B1F 75%)' }}>
      <Grid color="rgba(255,79,154,0.07)" />
      <div style={{ position: 'absolute', top: 250, width: '100%', textAlign: 'center', transform: `scale(${pop(frame, 0, 8)})` }}>
        <span style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: 70, color: '#fff', ...stroke(10) }}>{p.title || 'ВЫПУСК НА YOUTUBE'}</span>
      </div>
      <div style={{ position: 'absolute', left: 540 - 260, top: 380, width: 520, height: 600, borderRadius: 40, background: '#1B1636', border: '7px solid #fff', overflow: 'hidden', transform: `scale(${pop(frame, 3, 9)})` }}>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 380, fontFamily: FONT.emoji, filter: 'blur(18px) brightness(0.8)' }}>🧑</div>
        <div style={{ position: 'absolute', left: 60, right: 60, top: 230, height: 110, background: '#000', transform: 'rotate(-4deg)', display: 'grid', placeItems: 'center', border: '5px solid #fff' }}>
          <span style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: 52, color: '#fff' }}>СЕКРЕТНО</span>
        </div>
      </div>
      {frame > 10 && (
        <div style={{ position: 'absolute', top: 1020, left: '50%', transform: `translateX(-50%) scale(${pop(frame, 10, 8)}) rotate(-3deg)`, background: COLORS.pink, color: '#fff',
          fontFamily: FONT.title, fontWeight: 900, fontSize: 52, padding: '12px 34px', borderRadius: 18, border: '6px solid #000', boxShadow: '0 10px 0 #000', whiteSpace: 'nowrap' }}>
          {p.chip || 'СКОРО ▶'}
        </div>
      )}
    </AbsoluteFill>
  );
};

/* ---------- ask for comments ---------- */
export const CommentAsk: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const p = ctx.shot.props || {};
  const text: string = p.typing || 'какого котика добавить? 🐱';
  const typed = text.slice(0, Math.max(0, Math.floor((frame - 6) * 1.6)));
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 35%, #2A1F5C, #0E0B1F 75%)' }}>
      <Grid />
      <div style={{ position: 'absolute', top: 250, width: '100%', textAlign: 'center', fontSize: 190, fontFamily: FONT.emoji, transform: `scale(${pop(frame, 0, 9)}) rotate(${Math.sin(frame / 6) * 6}deg)` }}>💬</div>
      <div style={{ position: 'absolute', top: 500, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 4 }}>
        {CAT_COLORS.slice(0, 4).map(([b, e], i) => (
          <div key={i} style={{ position: 'relative', transform: `translateY(${Math.abs(Math.sin((frame + i * 7) / 6)) * -30}px) scale(${pop(frame, 4 + i * 3, 8)})` }}>
            <Cat size={200} body={b} ear={e} mood={i === 2 ? 'shock' : 'happy'} />
            <div style={{ position: 'absolute', top: -40, width: '100%', textAlign: 'center', fontFamily: FONT.title, fontWeight: 900, fontSize: 60, color: COLORS.yellow, ...stroke(8) }}>?</div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 60, right: 110, top: 800, height: 120, borderRadius: 60, background: '#fff', display: 'flex', alignItems: 'center', padding: '0 40px', boxShadow: '0 12px 0 rgba(0,0,0,0.35)' }}>
        <span style={{ fontFamily: `${FONT.body}, ${FONT.emoji}`, fontWeight: 700, fontSize: 42, color: typed ? '#1B1636' : '#9A94C0' }}>
          {typed || 'Добавить комментарий…'}{frame % 16 < 9 ? '|' : ''}
        </span>
      </div>
    </AbsoluteFill>
  );
};


/* ---------- dev console full of errors ---------- */
export const ConsoleShot: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const p = ctx.shot.props || {};
  const errs: string[] = p.errors || [
    'Uncaught TypeError: Cannot read properties of undefined',
    'ReferenceError: cat is not defined',
    'RangeError: Maximum call stack size exceeded',
    'SyntaxError: Unexpected token \'}\'',
    'TypeError: coins.toFixed is not a function',
    'Error: Всё работает (нет)',
  ];
  const n = Math.min(99, Math.floor(frame * (p.speed || 2.4)) + (p.startCount || 0));
  const [sx, sy] = shakeXY(frame, 0, 10, 20, ctx.shot.idx);
  return (
    <AbsoluteFill style={{ background: '#12040A', transform: `translate(${sx}px, ${sy}px)` }}>
      <AbsoluteFill style={{ background: 'repeating-linear-gradient(0deg, rgba(255,59,78,0.05) 0 2px, transparent 2px 6px)' }} />
      <div style={{ position: 'absolute', left: 40, right: 90, top: 250, fontFamily: FONT.mono, fontSize: 31, lineHeight: 1.5, color: '#FF8A94' }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 38, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          Console <span style={{ background: COLORS.red, borderRadius: 12, padding: '2px 16px' }}>{n}{n >= 99 ? '+' : ''}</span>
        </div>
        {Array.from({ length: Math.min(16, Math.floor(frame / 2) + 1) }, (_, i) => (
          <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', background: i % 2 ? undefined : 'rgba(255,59,78,0.12)', padding: '2px 8px' }}>
            ✖ {errs[i % errs.length]}
          </div>
        ))}
      </div>
      {p.stamp && frame > 6 && (
        <div style={{ position: 'absolute', top: 820, width: '100%', textAlign: 'center', transform: `scale(${pop(frame, 6, 7)}) rotate(-8deg)` }}>
          <span style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: 110, color: '#fff', background: COLORS.red, padding: '10px 40px', borderRadius: 20, border: '8px solid #000' }}>{p.stamp}</span>
        </div>
      )}
      <Vignette strength={0.7} color="60,0,10" />
    </AbsoluteFill>
  );
};

/* ---------- code that gets fully rewritten / must not be touched ---------- */
const FAKE_CODE = `function mergeCats(a, b) {
  if (a.lvl !== b.lvl) return;
  const cat = newCat(a.lvl + 1);
  grid[b.cell] = cat;
  coins += INCOME[cat.lvl];
  burst(b.cell);
}
function buyCat() {
  if (coins < price) return toast("Не хватает монет");
  coins -= price;
  spawn(randomCell());
}
function update(dt) {
  coins += perSec * dt * boost;
  save();
}`;

export const CodeMeme: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const p = ctx.shot.props || {};
  const lines = FAKE_CODE.split('\n');
  const rewrite = p.mode === 'rewrite';
  const scroll = rewrite ? frame * 46 : 0;
  const plus = Math.round(ease(frame, 2, ctx.dur, 0, p.plus || 1243));
  const minus = Math.round(ease(frame, 2, ctx.dur, 0, p.minus || 1198));
  return (
    <AbsoluteFill style={{ background: '#0B0918' }}>
      <Grid color="rgba(140,92,255,0.07)" />
      <div style={{ position: 'absolute', left: 40, right: 90, top: 250, height: 860, borderRadius: 32, background: '#151228', border: '3px solid #2E2658', overflow: 'hidden' }}>
        <div style={{ height: 70, display: 'flex', alignItems: 'center', gap: 12, padding: '0 26px', background: '#1D1838', color: '#fff', fontFamily: FONT.mono, fontSize: 26 }}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <div key={c} style={{ width: 20, height: 20, borderRadius: 10, background: c }} />)}
          <span style={{ marginLeft: 16 }}>game.js</span>
          {rewrite && <span style={{ marginLeft: 'auto', color: COLORS.mint }}>+{plus} <span style={{ color: COLORS.red }}>−{minus}</span></span>}
        </div>
        <div style={{ position: 'absolute', top: 70, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
          <div style={{ transform: `translateY(${-scroll % (lines.length * 46)}px)`, padding: '10px 20px', fontFamily: FONT.mono, fontSize: 30, lineHeight: '46px' }}>
            {[...lines, ...lines, ...lines, ...lines].map((ln, i) => (
              <div key={i} style={{ whiteSpace: 'pre', color: rewrite ? (i % 3 === 0 ? '#9FFFB0' : i % 3 === 1 ? '#FF9AA5' : '#E8E4FF') : '#E8E4FF',
                background: rewrite ? (i % 3 === 0 ? 'rgba(53,242,176,0.12)' : i % 3 === 1 ? 'rgba(255,59,78,0.12)' : undefined) : undefined }}>
                {rewrite ? (i % 3 === 0 ? '+ ' : i % 3 === 1 ? '- ' : '  ') : ''}{ln}
              </div>
            ))}
          </div>
        </div>
      </div>
      {p.mode === 'donttouch' && (
        <>
          {[-12, 9].map((r, i) => (
            <div key={i} style={{ position: 'absolute', left: -100, right: -100, top: 520 + i * 180, height: 90, transform: `rotate(${r}deg) translateX(${ease(frame, i * 4, i * 4 + 8, i ? 1200 : -1200, 0)}px)`,
              background: 'repeating-linear-gradient(45deg, #FFE14D 0 50px, #111 50px 100px)', display: 'grid', placeItems: 'center', border: '5px solid #000' }}>
              <span style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: 56, color: '#111', background: '#FFE14D', padding: '0 24px' }}>НЕ ТРОГАТЬ</span>
            </div>
          ))}
          <div style={{ position: 'absolute', top: 300, right: 120, fontFamily: FONT.mono, fontSize: 32, color: COLORS.mint, transform: `scale(${pop(frame, 10, 8)})` }}>// работает. не знаю почему.</div>
        </>
      )}
    </AbsoluteFill>
  );
};

/* ---------- big animated counter (bugs 1 → 3 → 7) ---------- */
export const CounterShot: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const p = ctx.shot.props || {};
  const steps: { w: number; v: string }[] = p.steps || [];
  let cur = steps[0];
  let at = 0;
  steps.forEach((s) => { const a = s.w < 0 ? -30 : Math.max(0, ctx.wordFrame(s.w)); if (frame >= a) { cur = s; at = a; } });
  const count = parseInt(cur?.v || '1', 10) || 1;
  return (
    <AbsoluteFill style={{ background: p.bg || 'radial-gradient(circle at 50% 40%, #3B1233, #12081A 75%)' }}>
      <Grid color="rgba(255,79,154,0.07)" />
      <div style={{ position: 'absolute', top: 250, width: '100%', textAlign: 'center' }}>
        <span style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: 64, color: '#fff', ...stroke(8) }}>{p.title}</span>
      </div>
      <div style={{ position: 'absolute', top: 360, width: '100%', textAlign: 'center', transform: `scale(${1 + 0.25 * Math.exp(-(frame - at) / 4)})` }}>
        <span style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: 330, color: COLORS.red, ...stroke(22), textShadow: '0 20px 0 #000' }}>{cur?.v}</span>
      </div>
      <div style={{ position: 'absolute', top: 780, left: 80, right: 120, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
        {Array.from({ length: Math.min(count, 14) }, (_, i) => (
          <span key={i} style={{ fontSize: 96, fontFamily: FONT.emoji, transform: `rotate(${(random(`bg${i}`) - 0.5) * 40 + Math.sin((frame + i * 5) / 3) * 10}deg) scale(${pop(frame, at + i, 6)})` }}>{p.icon || '🐛'}</span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
