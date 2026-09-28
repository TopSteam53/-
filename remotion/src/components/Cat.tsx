import React from 'react';

/** Procedural cute cat head (SVG). All original artwork. */
export const Cat: React.FC<{
  size?: number;
  body?: string;
  ear?: string;
  mood?: 'happy' | 'cry' | 'shock' | 'cool' | 'love';
  blink?: boolean;
  crown?: boolean;
  style?: React.CSSProperties;
}> = ({ size = 300, body = '#FFB35C', ear = '#FF8FB1', mood = 'happy', blink = false, crown = false, style }) => {
  const eye = (cx: number) => {
    if (blink) return <path d={`M${cx - 14} 118 q14 10 28 0`} stroke="#2B1B2E" strokeWidth={6} fill="none" strokeLinecap="round" />;
    if (mood === 'love')
      return <text x={cx} y={130} fontSize={40} textAnchor="middle" fill="#FF3B6B">♥</text>;
    if (mood === 'cool') return null;
    const r = mood === 'shock' ? 20 : 17;
    return (
      <g>
        <ellipse cx={cx} cy={118} rx={r} ry={r + 3} fill="#2B1B2E" />
        <circle cx={cx + 6} cy={110} r={6.5} fill="#fff" />
        <circle cx={cx - 5} cy={125} r={3} fill="#fff" opacity={0.8} />
      </g>
    );
  };
  return (
    <svg width={size} height={size} viewBox="0 0 240 240" style={style}>
      <defs>
        <radialGradient id={`g${body}`} cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#fff" stopOpacity={0.45} />
          <stop offset="60%" stopColor={body} stopOpacity={0} />
        </radialGradient>
      </defs>
      {crown && (
        <path d="M78 34 L92 6 L108 28 L120 0 L132 28 L148 6 L162 34 Z" fill="#FFD23F" stroke="#C98B00" strokeWidth={4} />
      )}
      <path d="M40 90 L52 18 L102 58 Z" fill={body} stroke="#2B1B2E" strokeWidth={6} strokeLinejoin="round" />
      <path d="M200 90 L188 18 L138 58 Z" fill={body} stroke="#2B1B2E" strokeWidth={6} strokeLinejoin="round" />
      <path d="M56 70 L60 36 L86 58 Z" fill={ear} />
      <path d="M184 70 L180 36 L154 58 Z" fill={ear} />
      <ellipse cx={120} cy={138} rx={100} ry={88} fill={body} stroke="#2B1B2E" strokeWidth={6} />
      <ellipse cx={120} cy={138} rx={100} ry={88} fill={`url(#g${body})`} />
      {eye(82)}
      {eye(158)}
      {mood === 'cool' && (
        <g>
          <rect x={52} y={100} width={62} height={32} rx={10} fill="#111" />
          <rect x={126} y={100} width={62} height={32} rx={10} fill="#111" />
          <rect x={110} y={108} width={20} height={6} fill="#111" />
          <rect x={60} y={105} width={20} height={6} rx={3} fill="#fff" opacity={0.5} />
        </g>
      )}
      <ellipse cx={62} cy={152} rx={16} ry={9} fill="#FF7FA8" opacity={0.55} />
      <ellipse cx={178} cy={152} rx={16} ry={9} fill="#FF7FA8" opacity={0.55} />
      <path d="M112 140 L128 140 L120 149 Z" fill="#FF6B8E" stroke="#2B1B2E" strokeWidth={3} strokeLinejoin="round" />
      {mood === 'shock' ? (
        <ellipse cx={120} cy={172} rx={12} ry={15} fill="#2B1B2E" />
      ) : mood === 'cry' ? (
        <path d="M100 176 q20 -16 40 0" stroke="#2B1B2E" strokeWidth={5} fill="none" strokeLinecap="round" />
      ) : (
        <path d="M120 150 q-10 16 -22 8 M120 150 q10 16 22 8" stroke="#2B1B2E" strokeWidth={5} fill="none" strokeLinecap="round" />
      )}
      <g stroke="#2B1B2E" strokeWidth={3.5} strokeLinecap="round">
        <line x1={30} y1={146} x2={70} y2={152} />
        <line x1={30} y1={166} x2={70} y2={162} />
        <line x1={210} y1={146} x2={170} y2={152} />
        <line x1={210} y1={166} x2={170} y2={162} />
      </g>
      {mood === 'cry' && (
        <g fill="#6EC8FF" stroke="#2B6FA8" strokeWidth={2}>
          <path d="M70 136 q-8 22 0 40 q8 -18 0 -40 Z" />
          <path d="M170 136 q-8 22 0 40 q8 -18 0 -40 Z" />
          <ellipse cx={70} cy={190} rx={14} ry={6} opacity={0.7} />
          <ellipse cx={170} cy={190} rx={14} ry={6} opacity={0.7} />
        </g>
      )}
    </svg>
  );
};

export const CAT_COLORS: [string, string][] = [
  ['#FFF3E6', '#FFB3C7'],
  ['#FFB35C', '#FF8FB1'],
  ['#A8B3C7', '#FF9FBF'],
  ['#3A3550', '#FF7FA8'],
  ['#F7D774', '#FF9FB5'],
  ['#9FE6C3', '#FF8FB1'],
];
