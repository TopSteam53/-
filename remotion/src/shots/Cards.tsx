import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Cat } from '../components/Cat';
import { Burst, Floaters, Grid, Rays, Stamp } from '../components/Fx';
import { clamp, COLORS, ease, FONT, pop, stroke } from '../lib';
import type { ShotCtx } from '../types';
import { GameVideo } from './Gameplay';

const Bg: React.FC<{ a?: string; b?: string }> = ({ a = '#2A1F5C', b = '#0E0B1F' }) => (
  <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 30%, ${a}, ${b} 75%)` }}><Grid /></AbsoluteFill>
);

/* ---------- crossout ---------- */
export const Crossout: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const p = ctx.shot.props || {};
  const items: string[] = p.items || [];
  const step = Math.max(5, Math.floor((ctx.dur - 8) / Math.max(items.length, 1)));
  const total = items.length;
  return (
    <AbsoluteFill>
      <Bg a="#3B1233" b="#12081A" />
      {p.flyaway && frame > 12 && <Floaters items={['💸', '💸', '💵']} n={16} seed={4} size={80} />}
      <div style={{ position: 'absolute', top: total === 1 ? 560 : 330, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 70 }}>
        {items.map((it, i) => {
          const at = i * step;
          const s = pop(frame, at, 8);
          const strike = ease(frame, at + 5, at + 10, 0, 1);
          const fly = p.flyaway ? ease(frame, at + 14, at + 30, 0, 1) : 0;
          return (
            <div key={i} style={{
              position: 'relative', transform: `scale(${s}) translateY(${-fly * 900}px) rotate(${(i % 2 ? 4 : -3) + fly * 25}deg)`,
              fontFamily: FONT.title, fontWeight: 900, fontSize: it.length > 10 ? 86 : 118, color: '#fff', ...stroke(10),
              textShadow: '0 10px 0 #000', opacity: 1 - fly * 0.6, whiteSpace: 'nowrap', fontVariantEmoji: 'emoji' as any,
            }}>
              {it}
              <div style={{ position: 'absolute', left: -20, top: '48%', height: 22, width: `${strike * 110}%`, background: COLORS.red, borderRadius: 11, transform: 'rotate(-4deg)', boxShadow: '0 4px 0 #000' }} />
              {frame >= at + 8 && <div style={{ position: 'absolute', right: -90, top: -40, fontSize: 110, transform: `scale(${pop(frame, at + 8, 6)})`, fontFamily: FONT.emoji }}>❌</div>}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ---------- party (RPG) ---------- */
const Stat: React.FC<{ label: string; v: number; color: string }> = ({ label, v, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 28, fontWeight: 700, color: '#CFC8FF' }}>
    <span style={{ width: 190 }}>{label}</span>
    {Array.from({ length: 5 }, (_, i) => <div key={i} style={{ width: 34, height: 20, borderRadius: 6, background: i < v ? color : '#2E2658' }} />)}
  </div>
);

const PartyCard: React.FC<{ at: number; frame: number; avatar: React.ReactNode; name: string; cls: string; grad: string; lvl: string; children?: React.ReactNode; w: number; from: 'left' | 'right' | 'top' }> = ({ at, frame, avatar, name, cls, grad, lvl, children, w, from }) => {
  if (frame < at) return <div style={{ width: w }} />;
  const t = ease(frame, at, at + 8, 1, 0);
  const dx = from === 'left' ? -700 * t : from === 'right' ? 700 * t : 0;
  const dy = from === 'top' ? -500 * t : 0;
  return (
    <div style={{
      width: w, padding: 4, borderRadius: 36, background: grad, transform: `translate(${dx}px,${dy}px) rotate(${t * 8}deg)`,
      boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
    }}>
      <div style={{ borderRadius: 32, background: '#17122E', padding: '26px 28px', fontFamily: FONT.body, color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div style={{ width: 110, height: 110, borderRadius: 55, background: grad, display: 'grid', placeItems: 'center', fontSize: 64, fontFamily: `${FONT.body}, ${FONT.emoji}`, fontWeight: 900, flexShrink: 0 }}>{avatar}</div>
          <div>
            <div style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: 50, lineHeight: 1.05 }}>{name}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#B9B0F0', marginTop: 6 }}>{cls}</div>
          </div>
          <div style={{ marginLeft: 'auto', alignSelf: 'flex-start', background: COLORS.yellow, color: '#1B1636', fontWeight: 900, fontSize: 26, borderRadius: 14, padding: '6px 14px' }}>{lvl}</div>
        </div>
        {children && <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>}
      </div>
    </div>
  );
};

export const Party: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const r: number[] = ctx.shot.props?.reveal || [0, 5, 7];
  const at = r.map((w) => (w < 0 ? -30 : w >= 99 ? 99999 : Math.max(0, ctx.wordFrame(w))));
  const focus = ctx.shot.props?.focus === 'me' ? ease(frame, 0, ctx.dur, 1.12, 1.2) : 1;
  return (
    <AbsoluteFill>
      <Bg a="#1F2F5C" b="#0B0A1A" />
      <div style={{ position: 'absolute', top: 262, width: '100%', textAlign: 'center', fontFamily: FONT.title, fontWeight: 900, fontSize: 60, color: COLORS.yellow, ...stroke(8), transform: `scale(${pop(frame, 0, 8)})` }}>
        ⚔ ТВОЯ КОМАНДА ⚔
      </div>
      <div style={{ position: 'absolute', top: 380, left: 50, right: 90, display: 'flex', flexDirection: 'column', gap: 30, alignItems: 'center', transform: `scale(${focus})`, transformOrigin: '50% 10%' }}>
        <PartyCard at={at[0]} frame={frame} from="top" w={900} avatar="🧑‍💻" name="Я" cls="обычный парень" lvl="УР. 1" grad="linear-gradient(135deg,#FFE14D,#FF9A3C)">
          <Stat label="Код" v={2} color={COLORS.orange} />
          <Stat label="Упорство" v={5} color={COLORS.mint} />
          <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.yellow }}>Навык: Ctrl+C → Ctrl+V</div>
        </PartyCard>
        <div style={{ display: 'flex', gap: 26 }}>
          <PartyCard at={at[1]} frame={frame} from="left" w={437} avatar="✦" name="Claude" cls="маг кода" lvl="ИИ" grad="linear-gradient(135deg,#FF9A6B,#D9653B)" />
          <PartyCard at={at[2]} frame={frame} from="right" w={437} avatar="◎" name="ChatGPT" cls="маг кода" lvl="ИИ" grad="linear-gradient(135deg,#35F2B0,#1FA37A)" />
        </div>
      </div>
      {at.slice(1).filter((a) => a < 9999).map((a, i) => <Burst key={i} at={a + 6} x={i ? 780 : 300} y={880} n={14} items={['✨', '⭐']} seed={20 + i} size={50} />)}
    </AbsoluteFill>
  );
};

/* ---------- developer console frame ---------- */
const Console: React.FC<{ children: React.ReactNode; title?: string }> = ({ children, title = 'Консоль разработчика' }) => (
  <div style={{ position: 'absolute', left: 50, right: 90, top: 330, height: 790, borderRadius: 40, background: '#F4F2FA', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.55)', fontFamily: FONT.body }}>
    <div style={{ height: 100, background: '#FFFFFF', display: 'flex', alignItems: 'center', padding: '0 36px', gap: 18, borderBottom: '2px solid #E4E0F0' }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,#8C5CFF,#FF4F9A)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 900, fontSize: 30 }}>🎮</div>
      <div style={{ fontWeight: 800, fontSize: 36, color: '#1B1636' }}>{title}</div>
      <div style={{ marginLeft: 'auto', fontSize: 26, color: '#8A84A8', fontWeight: 700 }}>Яндекс Игры</div>
    </div>
    <div style={{ padding: 36 }}>{children}</div>
  </div>
);

const GameRow: React.FC<{ status: React.ReactNode; clip: string }> = ({ status, clip }) => (
  <div style={{ display: 'flex', gap: 30, alignItems: 'center', background: '#fff', borderRadius: 28, padding: 26, boxShadow: '0 6px 20px rgba(40,20,90,0.08)' }}>
    <div style={{ width: 200, height: 200, borderRadius: 28, overflow: 'hidden', flexShrink: 0, background: '#FFD9E8' }}>
      <GameVideo clip={clip} from={10} style={{ objectPosition: '50% 40%' }} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: 52, color: '#1B1636' }}>Мурмерж</div>
      <div style={{ fontSize: 30, color: '#6E6890', fontWeight: 600 }}>Казуальные · Головоломки</div>
      {status}
    </div>
  </div>
);

export const Status: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const p = ctx.shot.props || {};
  return (
    <AbsoluteFill>
      <Bg a="#26225A" b="#0E0B1F" />
      <Console>
        <GameRow clip={ctx.tl.episode.mainClip || 'gameplay_main'} status={<div style={{ fontSize: 30, fontWeight: 800, color: '#8A84A8' }}>Статус: <span style={{ color: '#FF9A3C' }}>не опубликована</span></div>} />
        <div style={{ display: 'flex', gap: 24, marginTop: 30 }}>
          {[['Игроков', '0'], ['Доход', '0 ₽'], ['Оценка', '—']].map(([k, v]) => (
            <div key={k} style={{ flex: 1, background: '#fff', borderRadius: 24, padding: '24px 26px', boxShadow: '0 6px 20px rgba(40,20,90,0.08)' }}>
              <div style={{ fontSize: 26, color: '#8A84A8', fontWeight: 700 }}>{k}</div>
              <div style={{ fontFamily: FONT.title, fontSize: 54, fontWeight: 900, color: '#1B1636' }}>{v}</div>
            </div>
          ))}
        </div>
      </Console>
      <Stamp at={6} text={p.status || 'ЧЕРНОВИК'} color={COLORS.red} x={520} y={900} rot={-10} size={104} />
    </AbsoluteFill>
  );
};

export const Upload: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const end = Math.max(12, ctx.dur - 10);
  const prog = ease(frame, 6, end, 0, 100);
  const drop = ease(frame, 0, 8, -500, 0);
  const done = prog >= 99.5;
  return (
    <AbsoluteFill>
      <Bg a="#1E3A5C" b="#0B0A1A" />
      <Console title="Загрузка новой версии">
        <div style={{ height: 330, border: '5px dashed #B9B0E8', borderRadius: 30, display: 'grid', placeItems: 'center', background: '#FBFAFF', position: 'relative' }}>
          <div style={{ transform: `translateY(${drop}px)`, display: 'flex', alignItems: 'center', gap: 20, background: '#fff', padding: '26px 36px', borderRadius: 24, boxShadow: '0 16px 40px rgba(40,20,90,0.18)' }}>
            <div style={{ fontSize: 70, fontFamily: FONT.emoji }}>🗜️</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: '#1B1636', fontFamily: FONT.mono }}>murmerge_build.zip</div>
          </div>
        </div>
        <div style={{ marginTop: 44, fontSize: 34, fontWeight: 800, color: '#1B1636', display: 'flex', justifyContent: 'space-between' }}>
          <span>{done ? 'Готово!' : 'Загрузка…'}</span><span>{Math.round(prog)}%</span>
        </div>
        <div style={{ marginTop: 16, height: 40, borderRadius: 20, background: '#E4E0F0', overflow: 'hidden' }}>
          <div style={{ width: `${prog}%`, height: '100%', background: 'linear-gradient(90deg,#8C5CFF,#FF4F9A)', borderRadius: 20 }} />
        </div>
        {done && (
          <div style={{ marginTop: 40, fontSize: 46, fontWeight: 900, color: '#12A36E', transform: `scale(${pop(frame, end, 8)})`, transformOrigin: '0 50%' }}>✓ Загружено</div>
        )}
      </Console>
    </AbsoluteFill>
  );
};

/* ---------- roadmap ---------- */
const NODES = [
  ['💡', 'Идея'], ['🤖', 'Код с ИИ'], ['🐛', 'Баги'], ['🛡️', 'Модерация'], ['🚀', 'Релиз'], ['💰', 'Цифры'],
];
const NP = NODES.map((_, i) => ({ x: i % 2 ? 730 : 290, y: 330 + i * 148 }));

export const Roadmap: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const p = ctx.shot.props || {};
  const cont = !!p.continue;
  const draw = cont ? 1 : ease(frame, 0, Math.max(10, ctx.dur - 4), 0, 1);
  const lights: [number, number][] = p.lightOn || [];
  const lit = lights.filter(([w]) => frame >= ctx.wordFrame(w)).map(([, n]) => n);
  const litAt = (n: number) => { const l = lights.find(([, k]) => k === n); return l ? ctx.wordFrame(l[0]) : -1; };
  const d = NP.map((pt, i) => (i === 0 ? `M${pt.x} ${pt.y}` : `C ${NP[i - 1].x} ${NP[i - 1].y + 90}, ${pt.x} ${pt.y - 90}, ${pt.x} ${pt.y}`)).join(' ');
  return (
    <AbsoluteFill>
      <Bg a="#123B3A" b="#0A0F1A" />
      <svg width={1080} height={1920} style={{ position: 'absolute' }}>
        <path d={d} fill="none" stroke="#2F2A5C" strokeWidth={26} strokeLinecap="round" />
        <path d={d} fill="none" stroke={COLORS.yellow} strokeWidth={14} strokeLinecap="round" strokeDasharray="1 1" pathLength={1}
          strokeDashoffset={1 - draw} style={{ strokeDasharray: 1 } as any} />
      </svg>
      {NODES.map(([ic, label], i) => {
        const appear = cont ? 99 : i / (NODES.length - 1) <= draw + 0.02 ? 1 : 0;
        if (!appear) return null;
        const at = cont ? -20 : Math.round((i / (NODES.length - 1)) * Math.max(10, ctx.dur - 4));
        const on = lit.includes(i);
        const la = litAt(i);
        const s = pop(frame, at, 8) * (on ? 1 + 0.25 * pop(frame, la, 8) - 0.05 : 1);
        const left = NP[i].x < 540;
        return (
          <div key={i} style={{ position: 'absolute', left: NP[i].x, top: NP[i].y, transform: `translate(-50%,-50%) scale(${s})` }}>
            <div style={{
              width: 128, height: 128, borderRadius: 64, display: 'grid', placeItems: 'center', fontSize: 66, fontFamily: FONT.emoji,
              background: on ? COLORS.yellow : '#221C45', border: `6px solid ${on ? '#fff' : '#4A4290'}`,
              boxShadow: on ? `0 0 60px ${COLORS.yellow}` : '0 10px 30px rgba(0,0,0,0.5)',
            }}>{ic}</div>
            <div style={{
              position: 'absolute', top: '50%', [left ? 'left' : 'right']: 150, transform: 'translateY(-50%)', whiteSpace: 'nowrap',
              fontFamily: FONT.title, fontWeight: 900, fontSize: 50, color: on ? COLORS.yellow : '#fff', ...stroke(8),
            } as any}>{label}</div>
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: NP[0].x - 70, top: NP[0].y - 170, transform: `scale(${pop(frame, 2, 8)})` }}>
        <Cat size={130} body="#FFB35C" mood="happy" />
      </div>
    </AbsoluteFill>
  );
};

export { Rays };
