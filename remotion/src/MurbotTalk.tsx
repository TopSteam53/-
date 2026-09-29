import React from 'react';
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion';
import { Burst, Floaters, Grid, Vignette } from './components/Fx';
import { Murbot } from './components/Murbot';
import { Subtitles } from './components/Subtitles';
import { clamp, COLORS, f, FONT, FPS, pop, stroke } from './lib';
import { GameVideo } from './shots/Gameplay';
import type { Timeline } from './types';

/** Cloud "poof" when the mascot appears / disappears. */
const Poof: React.FC<{ at: number; x: number; y: number }> = ({ at, x, y }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0 || t > 22) return null;
  return (
    <>
      {Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2 + random(`pa${at}${i}`);
        const d = interpolate(t, [0, 16], [20, 170 + random(`pd${at}${i}`) * 60], clamp);
        const s = interpolate(t, [0, 8, 22], [40, 120, 150], clamp);
        return (
          <div key={i} style={{
            position: 'absolute', left: x + Math.cos(a) * d - s / 2, top: y + Math.sin(a) * d - s / 2, width: s, height: s,
            borderRadius: '50%', background: '#fff', opacity: interpolate(t, [0, 4, 22], [0, 0.95, 0], clamp), filter: 'blur(2px)',
          }} />
        );
      })}
    </>
  );
};

export const MurbotTalk: React.FC<{ timeline: Timeline }> = ({ timeline: tl }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / FPS;
  const ep = tl.episode;
  const shot = [...tl.shots].reverse().find((s) => t >= s.start) || tl.shots[0];
  const p = shot.props || {};
  const mouth = tl.mouth?.[frame] ?? 0;

  const enterAt = f(tl.lines[0].start) - 8;
  const exitAt = durationInFrames - 18;
  const cx = 960, cy = 440;
  const appear = pop(frame, enterAt, 10);
  const leave = interpolate(frame, [exitAt, exitAt + 10], [1, 0], clamp);
  const blinkPhase = (frame + 17) % 97;
  const blink = blinkPhase < 3 ? 1 : 0;
  const talkTilt = Math.sin(frame / 4) * mouth * 4;
  const squash = 1 + mouth * 0.035;

  // emphasis words make him hop
  let hop = 0;
  tl.lines.forEach((l) => l.words.forEach((w) => {
    if (w.emph) hop += -26 * Math.max(0, 1 - Math.abs(frame - f(w.start) - 3) / 6);
  }));

  const tagShot = tl.shots.find((s) => s.props?.tag);
  const tagAt = tagShot ? f(tagShot.start) : -1;
  const tagOn = tagShot && t >= tagShot.start && t < tagShot.end;

  return (
    <AbsoluteFill style={{ background: '#0E0B1F' }}>
      {ep.bgClip && (
        <AbsoluteFill style={{ filter: 'blur(26px) brightness(0.5) saturate(1.2)', transform: 'scale(1.15)' }}>
          <GameVideo clip={ep.bgClip} from={ep.bgFrom || 0} style={{ objectFit: 'cover' }} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 42%, rgba(140,92,255,0.35), rgba(14,11,31,0.85) 70%)' }} />
      <Grid color="rgba(255,255,255,0.04)" />
      <Floaters items={['✨', '⭐', '🐾', '✨']} n={16} seed={3} size={46} />

      {/* mascot */}
      <div style={{
        position: 'absolute', left: cx - 290, top: cy - 290 + hop, width: 580, height: 580,
        transform: `scale(${appear * leave}) rotate(${talkTilt}deg) scaleY(${squash})`, transformOrigin: '50% 70%',
        filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.45))',
      }}>
        <Murbot size={580} mood={p.mood || 'happy'} mouth={mouth} blink={blink} t={frame} />
      </div>
      <Poof at={enterAt} x={cx} y={cy} />
      <Burst at={enterAt + 2} x={cx} y={cy} n={24} items={['✨', '⭐', '💫']} seed={9} spread={700} size={60} />
      <Poof at={exitAt} x={cx} y={cy} />
      <Burst at={exitAt + 4} x={cx} y={cy} n={18} items={['✨', '💫']} seed={19} spread={600} size={50} />

      {/* name tag */}
      {tagOn && (
        <div style={{
          position: 'absolute', left: 90, top: 90, transform: `translateX(${interpolate(frame - tagAt, [0, 8], [-600, 0], clamp)}px) rotate(-2deg)`,
          background: '#fff', borderRadius: 26, padding: '18px 34px', border: '6px solid #000', boxShadow: '0 10px 0 #000',
        }}>
          <div style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: 64, color: '#8C5CFF', lineHeight: 1 }}>{p.tag}</div>
          <div style={{ fontFamily: FONT.body, fontWeight: 800, fontSize: 30, color: '#1B1636', marginTop: 6 }}>{p.tagSub}</div>
        </div>
      )}

      {p.caption && (
        <div style={{ position: 'absolute', right: 110, top: 150, transform: `scale(${pop(frame, f(shot.start) + 4, 8)}) rotate(4deg)` }}>
          <span style={{ fontFamily: FONT.title, fontWeight: 900, fontSize: 72, color: COLORS.yellow, ...stroke(10), whiteSpace: 'nowrap' }}>{p.caption}</span>
        </div>
      )}

      <Vignette strength={0.5} />
      <Subtitles tl={tl} hidden={() => false} y={930} left={260} width={1400} scale={0.85} />
    </AbsoluteFill>
  );
};
