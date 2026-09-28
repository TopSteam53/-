import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Grid } from '../components/Fx';
import { clamp, COLORS, FONT, pop } from '../lib';
import type { ShotCtx } from '../types';
import { colorize } from './Chat';

const CODE = [
  `// мурмерж — главный цикл
const TIERS = ["котёнок","рыжий","серый",
  "чёрный","пятнистый","КОРОЛЬ"];
function onCollide(a, b) {
  if (a.tier !== b.tier) return;
  const cat = spawnCat(a.tier + 1);
  cat.pos = mid(a.pos, b.pos);
  removeCats(a, b);
  score += 10 * (a.tier + 1);
  shakeScreen(4);
}
ysdk.features.LoadingAPI.ready();`,
  `// публикация на Яндекс Играх
YaGames.init().then((sdk) => {
  window.ysdk = sdk;
  sdk.adv.showFullscreenAdv();
  startGame();
});
function startGame() {
  spawnCat(0);
  requestAnimationFrame(loop);
}`,
];

const KeyCap: React.FC<{ label: string; at: number; frame: number; x: number; y: number }> = ({ label, at, frame, x, y }) => {
  const s = pop(frame, at, 8);
  const press = interpolate(frame - at, [6, 8, 11], [0, 12, 0], clamp);
  if (frame < at) return null;
  return (
    <div style={{
      position: 'absolute', left: x, top: y + press, transform: `translate(-50%,-50%) scale(${s})`, padding: '26px 44px',
      background: 'linear-gradient(#FFFFFF,#D9D4F2)', borderRadius: 30, boxShadow: `0 ${16 - press}px 0 #8C84B8, 0 30px 50px rgba(0,0,0,0.5)`,
      fontFamily: FONT.title, fontWeight: 900, fontSize: 64, color: '#1B1636', whiteSpace: 'nowrap',
    }}>{label}</div>
  );
};

export const Code: React.FC<{ ctx: ShotCtx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const p = ctx.shot.props || {};
  const src = CODE[p.variant || 0];
  const copy = p.mode === 'copypaste';
  const chars = copy ? src.length : Math.floor(frame * 9 + 40);
  const shown = src.slice(0, chars);
  const lines = shown.split('\n');
  const sel = copy ? interpolate(frame, [2, 12], [0, src.split('\n').length], clamp) : 0;
  const tr = interpolate(frame, [0, ctx.dur], [1.02, 1.1], clamp);
  return (
    <AbsoluteFill style={{ background: '#0B0918' }}>
      <Grid color="rgba(140,92,255,0.07)" />
      <div style={{
        position: 'absolute', left: 40, right: 80, top: 330, height: 790, borderRadius: 36, background: '#151228',
        border: '3px solid #2E2658', overflow: 'hidden', transform: `scale(${tr})`, boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{ height: 76, display: 'flex', alignItems: 'center', gap: 14, padding: '0 28px', background: '#1D1838' }}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <div key={c} style={{ width: 22, height: 22, borderRadius: 11, background: c }} />)}
          <div style={{ marginLeft: 24, padding: '10px 24px', background: '#151228', borderRadius: '14px 14px 0 0', color: '#fff', fontFamily: FONT.mono, fontSize: 26, marginTop: 18 }}>
            {p.variant ? 'yandex.js' : 'game.js'}
          </div>
        </div>
        <div style={{ padding: '24px 20px', fontFamily: FONT.mono, fontSize: 31, lineHeight: 1.5, color: '#E8E4FF' }}>
          {lines.map((ln, i) => (
            <div key={i} style={{ display: 'flex', whiteSpace: 'pre', background: i < sel ? 'rgba(77,163,255,0.35)' : undefined }}>
              <span style={{ width: 56, color: '#4F4880', textAlign: 'right', marginRight: 22, flexShrink: 0 }}>{i + 1}</span>
              <span>{colorize(ln)}{!copy && i === lines.length - 1 && frame % 16 < 9 ? <span style={{ background: COLORS.yellow, color: COLORS.yellow }}>▌</span> : null}</span>
            </div>
          ))}
        </div>
      </div>
      {copy && (
        <>
          <KeyCap label="Ctrl + C" at={8} frame={frame} x={330} y={1000} />
          <KeyCap label="Ctrl + V" at={20} frame={frame} x={700} y={1010} />
        </>
      )}
    </AbsoluteFill>
  );
};
