import { Easing, interpolate, random } from 'remotion';

export const FPS = 30;
export const W = 1080;
export const H = 1920;
export const f = (sec: number) => Math.round(sec * FPS);

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const ease = (frame: number, from: number, to: number, a: number, b: number, e = Easing.out(Easing.cubic)) =>
  interpolate(frame, [from, to], [a, b], { ...clamp, easing: e });

/** springy pop 0->1 with overshoot, starting at frame `at` */
export const pop = (frame: number, at: number, dur = 9) => {
  const t = Math.max(0, Math.min(1, (frame - at) / dur));
  if (frame < at) return 0;
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export const shakeXY = (frame: number, at: number, dur: number, amp: number, seed = 1) => {
  const t = frame - at;
  if (t < 0 || t > dur) return [0, 0];
  const k = amp * (1 - t / dur);
  return [(random(`sx${seed}${frame}`) - 0.5) * 2 * k, (random(`sy${seed}${frame}`) - 0.5) * 2 * k];
};

export const COLORS = {
  bg: '#0E0B1F',
  panel: '#1B1636',
  yellow: '#FFE14D',
  pink: '#FF4F9A',
  mint: '#35F2B0',
  red: '#FF3B4E',
  blue: '#4DA3FF',
  orange: '#FF9A3C',
  purple: '#8C5CFF',
  white: '#FFFFFF',
};

export const FONT = {
  title: '"Unbounded", sans-serif',
  body: '"Montserrat", sans-serif',
  mono: '"JetBrains Mono", monospace',
  emoji: '"Noto Color Emoji"',
};

export const stroke = (px: number, color = '#000') => ({
  WebkitTextStroke: `${px}px ${color}`,
  paintOrder: 'stroke fill' as any,
});
