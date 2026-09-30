import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Grid, Rays, Vignette } from './components/Fx';
import { COLORS, FONT, stroke } from './lib';
import { GameVideo } from './shots/Gameplay';
import { FocusVideo } from './shots/Meme';

/**
 * TikTok cover (1080x1920). Key content stays inside the centre 3:4 crop (y≈240..1680) that the profile grid shows.
 * props: { bgClip, bgFrom, lines: [text, size, color][], chip, series, panels: [{clip, from, focus, zoom, label}], emoji }
 */
export const Cover: React.FC<{ cover: any }> = ({ cover: c }) => {
  const panels: any[] = c.panels || [];
  return (
    <AbsoluteFill style={{ background: '#0E0B1F' }}>
      {c.bgClip && (
        <AbsoluteFill style={{ filter: 'blur(20px) brightness(0.45) saturate(1.4)', transform: 'scale(1.2)' }}>
          <GameVideo clip={c.bgClip} from={c.bgFrom || 0} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ opacity: 0.35 }}><Rays c1="#FF4F9A" c2="#8C5CFF" /></AbsoluteFill>
      <Grid color="rgba(255,255,255,0.05)" />
      <div style={{ position: 'absolute', top: 300, width: '100%', display: 'flex', justifyContent: 'center' }}>
        <div style={{ background: COLORS.pink, color: '#fff', fontFamily: FONT.title, fontWeight: 900, fontSize: 50, padding: '10px 30px', borderRadius: 18, border: '6px solid #000', boxShadow: '0 10px 0 #000', transform: 'rotate(-3deg)' }}>{c.chip}</div>
      </div>
      <div style={{ position: 'absolute', top: 430, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {(c.lines || []).map(([t, size, color]: [string, number, string], i: number) => (
          <div key={i} style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: size, color: color || '#fff', lineHeight: 1.05, ...stroke(size * 0.11), textShadow: `0 ${size * 0.09}px 0 #000`, transform: `rotate(${i % 2 ? 2 : -2}deg)`, whiteSpace: 'nowrap' }}>{t}</div>
        ))}
      </div>
      <div style={{ position: 'absolute', top: 1030, left: 60, right: 60, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24 }}>
        {panels.map((p, i) => (
          <React.Fragment key={i}>
            {i > 0 && <div style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: 110, color: COLORS.red, ...stroke(12) }}>→</div>}
            <div style={{ position: 'relative', width: 400, height: 300, borderRadius: 30, overflow: 'hidden', border: `7px solid ${i ? COLORS.red : COLORS.mint}`, boxShadow: '0 14px 0 #000' }}>
              <FocusVideo clip={p.clip} from={p.from} focus={p.focus} zoom={p.zoom || 2.4} w={400} h={300} />
              {p.label && <div style={{ position: 'absolute', left: 12, bottom: 12, background: i ? COLORS.red : COLORS.mint, color: '#fff', fontFamily: FONT.title, fontWeight: 900, fontSize: 30, padding: '4px 14px', borderRadius: 10, border: '4px solid #000' }}>{p.label}</div>}
            </div>
          </React.Fragment>
        ))}
      </div>
      {c.bubble && (
        <div style={{ position: 'absolute', top: 1060, left: 80, right: 120, display: 'flex', justifyContent: 'center' }}>
          <div style={{ position: 'relative', background: '#262046', color: '#fff', borderRadius: 40, borderBottomLeftRadius: 10, padding: '30px 40px', border: '5px solid #3A3170',
            boxShadow: '0 16px 0 rgba(0,0,0,0.5)', fontFamily: `${FONT.body}, ${FONT.emoji}`, fontWeight: 900, fontSize: 58 }}>
            <div style={{ fontSize: 30, color: COLORS.mint, fontWeight: 800, marginBottom: 6 }}>✦ ИИ-ассистент</div>
            {c.bubble}
            {c.stamp && (
              <div style={{ position: 'absolute', right: -30, top: -40, transform: 'rotate(-14deg)', border: `10px solid ${COLORS.red}`, color: COLORS.red, borderRadius: 20,
                padding: '4px 26px', fontFamily: FONT.title, fontWeight: 900, fontSize: 84, background: 'rgba(255,255,255,0.92)' }}>{c.stamp}</div>
            )}
          </div>
        </div>
      )}
      {c.emoji && <div style={{ position: 'absolute', left: 70, top: 1270, fontSize: 150, fontFamily: FONT.emoji, transform: 'rotate(14deg)' }}>{c.emoji}</div>}
      <div style={{ position: 'absolute', top: 1420, width: '100%', textAlign: 'center', fontFamily: FONT.title, fontWeight: 900, fontSize: 46, color: '#fff', ...stroke(6) }}>{c.series}</div>
      <Vignette strength={0.55} />
    </AbsoluteFill>
  );
};
