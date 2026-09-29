import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { ShotFx } from './components/Fx';
import { Subtitles } from './components/Subtitles';
import { COLORS, f, FONT, FPS, pop, shakeXY } from './lib';
import { Bug } from './shots/Bug';
import { Crossout, Party, Roadmap, Status, Upload } from './shots/Cards';
import { Chat } from './shots/Chat';
import { Code } from './shots/Code';
import { Gameplay } from './shots/Gameplay';
import { Money } from './shots/Money';
import { Subscribe, Teaser, TgCard, Title, Verdict } from './shots/Titles';
import { BigText, CoinRain, Flow, Formula, ListCard, Phone } from './shots/Broll';
import type { ShotCtx, Timeline } from './types';

const SHOTS: Record<string, React.FC<{ ctx: ShotCtx }>> = {
  gameplay: Gameplay, aichat: Chat, code: Code, crossout: Crossout, party: Party, title: Title, upload: Upload,
  roadmap: Roadmap, money: Money, bug: Bug, status: Status, subscribe: Subscribe, teaser: Teaser, verdict: Verdict, tg: TgCard,
  phone: Phone, coins: CoinRain, big: BigText, list: ListCard, flow: Flow, formula: Formula,
};

const NO_HUD = new Set(['title', 'subscribe', 'teaser', 'verdict', 'money', 'status']);

const Hud: React.FC<{ tl: Timeline }> = ({ tl }) => {
  const frame = useCurrentFrame();
  if (!tl.hud) return null;
  const at = f(tl.hud.start);
  if (frame < at) return null;
  const t = frame / FPS;
  const shot = tl.shots.find((s) => t >= s.start && t < s.end);
  if (shot && NO_HUD.has(shot.type)) return null;
  return (
    <div style={{
      position: 'absolute', left: 40, top: 236, transform: `scale(${pop(frame, at, 8)})`, transformOrigin: '0 50%',
      display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(14,11,31,0.82)', border: `3px solid ${COLORS.yellow}`,
      borderRadius: 22, padding: '10px 22px 10px 16px', fontFamily: FONT.body, fontWeight: 900, fontSize: 34, color: '#fff',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    }}>
      <span style={{ fontFamily: FONT.emoji }}>💰</span>
      <span style={{ color: '#CFC8FF', fontSize: 26, letterSpacing: 1 }}>ЗАРАБОТАНО:</span>
      <span style={{ color: COLORS.yellow }}>{tl.hud.amount}</span>
    </div>
  );
};

/** Camera shake on heavy SFX hits (booms) */
const useCameraShake = (tl: Timeline) => {
  const frame = useCurrentFrame();
  let x = 0, y = 0;
  tl.sfx.filter((s) => s.name === 'boom').forEach((s, i) => {
    const [dx, dy] = shakeXY(frame, f(s.t), 12, 22, i + 3);
    x += dx; y += dy;
  });
  return `translate(${x}px, ${y}px)`;
};

export const Main: React.FC<{ timeline: Timeline }> = ({ timeline: tl }) => {
  const cam = useCameraShake(tl);
  const lineById = Object.fromEntries(tl.lines.map((l) => [l.id, l]));
  const hidden = (t: number) => {
    const s = tl.shots.find((x) => t >= x.start && t < x.end);
    return !!s?.hideSubs;
  };
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <AbsoluteFill style={{ transform: `${cam} scale(1.03)` }}>
        {tl.shots.map((shot) => {
          const from = f(shot.start);
          const dur = Math.max(1, f(shot.end) - from);
          const line = lineById[shot.line];
          const ctx: ShotCtx = {
            shot, line, tl, dur,
            wordFrame: (i: number) => (line.words[i] ? f(line.words[i].start) - from : 0),
          };
          const C = SHOTS[shot.type];
          if (!C) throw new Error(`Unknown shot type ${shot.type}`);
          return (
            <Sequence key={shot.idx} from={from} durationInFrames={dur} name={`${shot.idx} ${shot.type}`}>
              <ShotFx fx={shot.fx || []} seed={shot.idx}>
                <C ctx={ctx} />
              </ShotFx>
            </Sequence>
          );
        })}
      </AbsoluteFill>
      <Hud tl={tl} />
      <Subtitles tl={tl} hidden={hidden} />
    </AbsoluteFill>
  );
};
