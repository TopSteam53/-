import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { clamp, COLORS, FONT, FPS } from '../lib';
import type { Timeline, Word } from '../types';

// Safe zone for TikTok UI (1080x1920): keep text within x 70..930, y 260..1400.
export const SUB_Y = 1235;
const MAX_CHARS = 16;

type Page = { words: (Word & { key: string })[]; start: number; end: number };

export const buildPages = (tl: Timeline): Page[] => {
  const pages: Page[] = [];
  tl.lines.forEach((line, li) => {
    let cur: Page | null = null;
    line.words.forEach((w, wi) => {
      const len = cur ? cur.words.reduce((a, x) => a + x.text.length + 1, 0) : 0;
      if (!cur || cur.words.length >= 3 || len + w.text.length > MAX_CHARS) {
        cur = { words: [], start: w.start, end: line.end };
        pages.push(cur);
      }
      cur.words.push({ ...w, key: `${li}-${wi}` });
      if (/[.!?,:…»—]$/.test(w.text) && wi < line.words.length - 1) cur = null;
    });
  });
  pages.forEach((p, i) => {
    const next = pages[i + 1];
    p.end = next ? Math.min(next.start, p.words[p.words.length - 1].end + 0.35) : p.end + 0.3;
    if (next && next.start - p.end < 0.25) p.end = next.start;
  });
  return pages;
};

const clean = (s: string) => s.replace(/[«»"]/g, '').replace(/\.\.\.$/, '…');

export const Subtitles: React.FC<{ tl: Timeline; hidden: (t: number) => boolean; y?: number; left?: number; width?: number; scale?: number }> = ({ tl, hidden, y = SUB_Y, left = 60, width = 880, scale = 1 }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const pages = React.useMemo(() => buildPages(tl), [tl]);
  const page = pages.find((p) => t >= p.start && t < p.end);
  if (!page || hidden(t)) return null;
  const pf = Math.round(page.start * FPS);
  const enter = interpolate(frame - pf, [0, 4], [0.7, 1], clamp);
  const long = page.words.reduce((a, w) => a + w.text.length, 0) > 13;
  const size = (long ? 84 : 100) * scale;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', left, width, top: y, transform: `translateY(-50%) scale(${enter})`,
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', columnGap: 34, rowGap: 0,
        textAlign: 'center',
      }}>
        {page.words.map((w) => {
          const wf = Math.round(w.start * FPS);
          const active = frame >= wf && t < (w.end + 0.05);
          const spoken = frame >= wf;
          const p = interpolate(frame - wf, [0, 3, 7], [1, 1.12, 1.04], clamp);
          const color = active ? (w.emph ? COLORS.pink : COLORS.yellow) : '#FFFFFF';
          return (
            <span key={w.key} style={{
              fontFamily: FONT.body, fontWeight: 900, fontSize: size, lineHeight: 1.12, textTransform: 'uppercase',
              color, WebkitTextStroke: '14px #000', paintOrder: 'stroke fill' as any,
              textShadow: '0 8px 0 rgba(0,0,0,0.85), 0 0 30px rgba(0,0,0,0.5)',
              display: 'inline-block', transform: `scale(${active ? p : 1}) rotate(${active && w.emph ? -3 : 0}deg)`,
              opacity: spoken ? 1 : 0.92,
            }}>{clean(w.text)}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
