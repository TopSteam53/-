export type Word = { text: string; start: number; end: number; emph: boolean };
export type Line = { id: string; start: number; end: number; words: Word[] };
export type Shot = {
  idx: number; start: number; end: number; line: string; type: string;
  props?: Record<string, any>; fx?: string[]; sfx?: string[]; hideSubs?: boolean;
};
export type Timeline = {
  id: string; fps: number; duration: number; lines: Line[]; shots: Shot[];
  sfx: { t: number; name: string }[];
  hud?: { start: number; amount: string } | null;
  episode: any;
  musicInfo?: { final_hit: number; drop_times: number[]; bpm: number };
};
export type ShotCtx = {
  shot: Shot; line: Line; tl: Timeline;
  dur: number; // frames
  /** frame (relative to shot start) at which word i of the shot's line starts */
  wordFrame: (i: number) => number;
};
