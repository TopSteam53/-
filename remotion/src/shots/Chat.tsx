import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Grid } from '../components/Fx';
import { clamp, COLORS, FONT, pop } from '../lib';
import type { ShotCtx } from '../types';

type Msg = { who: 'me' | 'ai'; text: string; at: number; code?: string; speed?: number; big?: boolean };

const SCRIPTS: Record<string, (ctx: ShotCtx) => Msg[]> = {
  coding: () => [
    { who: 'me', text: 'сделай игру, где котики падают и сливаются в котиков побольше 🐱', at: 0 },
    { who: 'ai', text: 'Отличная идея! Вот готовый код:', at: 6, speed: 2.2,
      code: 'const cats = [];\nfunction merge(a, b) {\n  const tier = a.tier + 1;\n  spawnCat(tier, mid(a, b));\n  score += TIERS[tier].points;\n  playSound("meow");\n}' },
  ],
  coding1: () => [
    { who: 'me', text: 'как выложить игру на Яндекс Игры? объясни как для чайника', at: 0 },
    { who: 'ai', text: 'Легко! 1) Собери билд 2) Подключи SDK 3) Загрузи архив в консоль 4) Отправь на модерацию ✅', at: 5, speed: 3.2 },
  ],
  angry: () => [
    { who: 'me', text: 'ПОЧЕМУ ОПЯТЬ НЕ РАБОТАЕТ??? 😡', at: 0, big: true },
    { who: 'ai', text: 'Прошу прощения за путаницу! Вот исправленная версия:', at: 9, speed: 2.6, code: 'function merge(a, b) {\n  // теперь точно работает 🙂' },
  ],
  fixagain: () => [
    { who: 'me', text: 'исправь, пожалуйста, ещё раз 🙏', at: 0 },
    { who: 'me', text: 'ещё раз', at: 9 },
    { who: 'me', text: 'ну пожалуйста 🥺', at: 15 },
    { who: 'me', text: 'ЕЩЁ. РАЗ.', at: 21, big: true },
  ],
};

const Bubble: React.FC<{ m: Msg; frame: number }> = ({ m, frame }) => {
  const s = pop(frame, m.at, 8);
  const me = m.who === 'me';
  const typed = m.who === 'ai' ? Math.max(0, Math.floor((frame - m.at - 4) * (m.speed || 2))) : 9999;
  const text = m.text.slice(0, typed);
  const codeChars = Math.max(0, Math.floor((frame - m.at - 4 - m.text.length / (m.speed || 2)) * 7));
  const typing = m.who === 'ai' && frame >= m.at && frame < m.at + 4;
  return (
    <div style={{
      alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '84%', transform: `scale(${s})`, transformOrigin: me ? '100% 100%' : '0% 100%',
      background: me ? 'linear-gradient(135deg,#7B5CFF,#B45CFF)' : '#262046', color: '#fff',
      borderRadius: 34, borderBottomRightRadius: me ? 8 : 34, borderBottomLeftRadius: me ? 34 : 8,
      padding: '26px 32px', fontFamily: FONT.body, fontWeight: m.big ? 900 : 600, fontSize: m.big ? 58 : 40, lineHeight: 1.25,
      boxShadow: '0 12px 30px rgba(0,0,0,0.35)', fontVariantEmoji: 'emoji' as any,
    }}>
      {!me && (
        <div style={{ fontSize: 26, fontWeight: 800, color: COLORS.mint, marginBottom: 8, letterSpacing: 1 }}>✦ ИИ-ассистент</div>
      )}
      {typing ? <span style={{ letterSpacing: 6 }}>• • •</span> : text}
      {m.code && codeChars > 0 && (
        <pre style={{
          margin: '18px 0 0', background: '#0B0918', borderRadius: 18, padding: '20px 22px', fontFamily: FONT.mono, fontSize: 28,
          color: '#C9F7FF', whiteSpace: 'pre-wrap', lineHeight: 1.35, border: '2px solid #3A3170',
        }}>{colorize(m.code.slice(0, codeChars))}</pre>
      )}
    </div>
  );
};

export const colorize = (code: string) =>
  code.split(/(\b(?:const|function|return|let|if|else|new|for)\b|"[^"\n]*"?|\/\/.*|\d+)/g).map((part, i) => {
    let color: string | undefined;
    if (/^(const|function|return|let|if|else|new|for)$/.test(part)) color = '#FF7AC6';
    else if (/^"/.test(part)) color = '#B8F28A';
    else if (/^\/\//.test(part)) color = '#7A7899';
    else if (/^\d+$/.test(part)) color = '#FFB86B';
    return <span key={i} style={{ color }}>{part}</span>;
  });

export const Chat: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const p = ctx.shot.props || {};
  const key = p.mode + (p.variant ? String(p.variant) : '');
  const msgs = (SCRIPTS[key] || SCRIPTS.coding)(ctx);
  const visible = msgs.filter((m) => frame >= m.at);
  const shake = key === 'angry' && frame >= 0 && frame < 10 ? Math.sin(frame * 3) * 12 : 0;
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(circle at 30% 20%, #2A1F5C, #0E0B1F 70%)' }}>
      <Grid />
      <div style={{
        position: 'absolute', left: 50, right: 90, top: 330, height: 790, borderRadius: 44, background: 'rgba(20,16,42,0.92)',
        border: '3px solid #3A3170', boxShadow: '0 30px 80px rgba(0,0,0,0.5)', overflow: 'hidden', transform: `translateX(${shake}px)`,
      }}>
        <div style={{ height: 96, display: 'flex', alignItems: 'center', gap: 18, padding: '0 34px', borderBottom: '2px solid #3A3170', fontFamily: FONT.body, color: '#fff' }}>
          <div style={{ width: 54, height: 54, borderRadius: 27, background: 'linear-gradient(135deg,#35F2B0,#4DA3FF)', display: 'grid', placeItems: 'center', fontSize: 30 }}>✦</div>
          <div style={{ fontWeight: 800, fontSize: 36 }}>Чат с нейросетью</div>
          <div style={{ marginLeft: 'auto', color: COLORS.mint, fontSize: 26, fontWeight: 700 }}>● онлайн</div>
        </div>
        <div style={{ position: 'absolute', left: 30, right: 30, bottom: 30, top: 120, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 24 }}>
          {visible.map((m, i) => <Bubble key={i} m={m} frame={frame} />)}
        </div>
      </div>
    </AbsoluteFill>
  );
};
