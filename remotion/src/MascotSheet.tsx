import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Mascot, MascotMood } from './components/Mascot';
import { FONT } from './lib';

const MOODS: [MascotMood, string, number][] = [
  ['happy', 'радуется', 0], ['talk', 'говорит', 0.8], ['smug', 'самодовольный', 0],
  ['sus', 'подозревает', 0], ['shock', 'в шоке', 0.5], ['love', 'влюбился в котика', 0],
];

export const MascotSheet: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 40%, #2A1F5C, #0E0B1F 75%)', fontFamily: FONT.title }}>
      <div style={{ position: 'absolute', top: 40, width: '100%', textAlign: 'center', color: '#FFE14D', fontSize: 64, fontWeight: 900 }}>БАРСИК — концепт</div>
      <div style={{ position: 'absolute', top: 150, left: 60, right: 60, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', rowGap: 10 }}>
        {MOODS.map(([m, label, mouth], i) => (
          <div key={m} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Mascot size={330} mood={m} mouth={mouth} t={frame + i * 20} />
            <div style={{ color: '#fff', fontSize: 34, fontWeight: 900, marginTop: -6 }}>{label}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
