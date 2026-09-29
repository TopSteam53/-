import React from 'react';

export type MurbotMood = 'happy' | 'smug' | 'shock' | 'sad' | 'love' | 'sus' | 'talk';

/**
 * Мурбот — channel mascot: a floating cat-robot "pixie" (original design).
 * mouth: 0..1 (drive from voice amplitude for lip-sync), blink: 0..1, t: frame for idle motion.
 */
export const Murbot: React.FC<{
  size?: number; mood?: MurbotMood; mouth?: number; blink?: number; t?: number; glow?: boolean; style?: React.CSSProperties;
}> = ({ size = 400, mood = 'happy', mouth = 0, blink = 0, t = 0, glow = true, style }) => {
  const bob = Math.sin(t / 9) * 6;
  const earWiggle = Math.sin(t / 5) * 3;
  const tail = Math.sin(t / 7) * 12;
  const eyeCol = mood === 'love' ? '#FF6FAE' : mood === 'shock' ? '#FFE14D' : '#6FF6FF';
  const eyeOpen = Math.max(0.08, 1 - blink);

  const eye = (cx: number, right: boolean) => {
    const cy = 150;
    if (mood === 'happy' || mood === 'talk')
      return blink > 0.5
        ? <path d={`M${cx - 16} ${cy} h32`} stroke={eyeCol} strokeWidth={9} strokeLinecap="round" />
        : <path d={`M${cx - 18} ${cy + 6} q18 -26 36 0`} stroke={eyeCol} strokeWidth={9} fill="none" strokeLinecap="round" />;
    if (mood === 'love') return <text x={cx} y={cy + 16} fontSize={48} textAnchor="middle" fill={eyeCol}>♥</text>;
    if (mood === 'sad') return <path d={`M${cx - 16} ${cy + (right ? -6 : 6)} L${cx + 16} ${cy + (right ? 6 : -6)}`} stroke={eyeCol} strokeWidth={9} strokeLinecap="round" />;
    if (mood === 'sus') return <rect x={cx - 18} y={cy - 4} width={36} height={10} rx={5} fill={eyeCol} />;
    if (mood === 'smug') return right
      ? <path d={`M${cx - 18} ${cy + 6} q18 -22 36 0`} stroke={eyeCol} strokeWidth={9} fill="none" strokeLinecap="round" />
      : <rect x={cx - 18} y={cy - 2} width={36} height={9} rx={4.5} fill={eyeCol} />;
    // shock
    return <ellipse cx={cx} cy={cy} rx={17} ry={22 * eyeOpen} fill={eyeCol} />;
  };

  const mo = Math.max(0, Math.min(1, mouth));
  return (
    <svg width={size} height={size} viewBox="0 0 320 320" style={{ overflow: 'visible', ...style }}>
      <defs>
        <radialGradient id="mbBody" cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="45%" stopColor="#D9CCFF" />
          <stop offset="100%" stopColor="#8C6CFF" />
        </radialGradient>
        <radialGradient id="mbGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#9FF3FF" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#9FF3FF" stopOpacity={0} />
        </radialGradient>
        <linearGradient id="mbVisor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2A1F5C" />
          <stop offset="100%" stopColor="#0E0B1F" />
        </linearGradient>
      </defs>
      {glow && <circle cx={160} cy={170} r={165} fill="url(#mbGlow)" />}
      <g transform={`translate(0 ${bob})`}>
        {/* tail */}
        <path d={`M225 225 q60 ${-10 + tail} 55 -70 q-4 -26 -24 -18`} stroke="#8C6CFF" strokeWidth={16} fill="none" strokeLinecap="round" />
        <circle cx={256} cy={137 + tail * 0.3} r={11} fill="#6FF6FF" />
        {/* antenna */}
        <line x1={160} y1={62} x2={160} y2={24} stroke="#8C6CFF" strokeWidth={8} strokeLinecap="round" />
        <circle cx={160} cy={18} r={15} fill="#FFE14D" stroke="#C98B00" strokeWidth={3} />
        <text x={160} y={25} fontSize={18} textAnchor="middle">🐾</text>
        {/* ears */}
        <g transform={`rotate(${-earWiggle} 95 90)`}>
          <path d="M62 120 L78 36 L140 84 Z" fill="url(#mbBody)" stroke="#2B1B4E" strokeWidth={6} strokeLinejoin="round" />
          <path d="M82 96 L88 58 L118 82 Z" fill="#6FF6FF" opacity={0.85} />
        </g>
        <g transform={`rotate(${earWiggle} 225 90)`}>
          <path d="M258 120 L242 36 L180 84 Z" fill="url(#mbBody)" stroke="#2B1B4E" strokeWidth={6} strokeLinejoin="round" />
          <path d="M238 96 L232 58 L202 82 Z" fill="#6FF6FF" opacity={0.85} />
        </g>
        {/* head */}
        <ellipse cx={160} cy={165} rx={118} ry={100} fill="url(#mbBody)" stroke="#2B1B4E" strokeWidth={6} />
        {/* visor */}
        <rect x={72} y={110} width={176} height={110} rx={48} fill="url(#mbVisor)" stroke="#2B1B4E" strokeWidth={4} />
        <rect x={86} y={118} width={60} height={12} rx={6} fill="#fff" opacity={0.15} />
        {eye(125, false)}
        {eye(195, true)}
        {/* mouth: LED that opens with the voice */}
        {mood === 'shock'
          ? <ellipse cx={160} cy={194} rx={12} ry={10 + mo * 8} fill={eyeCol} />
          : mo > 0.08
            ? <ellipse cx={160} cy={192} rx={16 + mo * 6} ry={3 + mo * 13} fill={eyeCol} />
            : mood === 'sad'
              ? <path d="M144 200 q16 -12 32 0" stroke={eyeCol} strokeWidth={6} fill="none" strokeLinecap="round" />
              : <path d="M146 190 q7 9 14 0 q7 9 14 0" stroke={eyeCol} strokeWidth={6} fill="none" strokeLinecap="round" />}
        {/* cheeks */}
        <ellipse cx={92} cy={210} rx={16} ry={8} fill="#FF7FA8" opacity={0.6} />
        <ellipse cx={228} cy={210} rx={16} ry={8} fill="#FF7FA8" opacity={0.6} />
        {/* floating paws */}
        <ellipse cx={112} cy={284 + Math.sin(t / 6) * 5} rx={22} ry={16} fill="url(#mbBody)" stroke="#2B1B4E" strokeWidth={5} />
        <ellipse cx={208} cy={284 + Math.cos(t / 6) * 5} rx={22} ry={16} fill="url(#mbBody)" stroke="#2B1B4E" strokeWidth={5} />
      </g>
    </svg>
  );
};
