import { useState } from 'react';

import { Calibrate } from './adapters/driving/react/routes/Calibrate.js';
import { EarTraining } from './adapters/driving/react/routes/EarTraining.js';
import { PitchMirror } from './adapters/driving/react/routes/PitchMirror.js';

type Screen = 'calibrate' | 'ear' | 'mirror';
type EarMode = 'discrimination' | 'identification' | null;

export function App() {
  const [screen, setScreen] = useState<Screen>('calibrate');
  const [earMode, setEarMode] = useState<EarMode>(null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="border-b border-slate-800 p-3 flex gap-2 text-sm">
        <button
          onClick={() => setScreen('calibrate')}
          className={pill(screen === 'calibrate')}
        >
          1 Calibrate
        </button>
        <button
          onClick={() => {
            setScreen('ear');
            setEarMode(null);
          }}
          className={pill(screen === 'ear')}
        >
          2 Ear training
        </button>
        <button onClick={() => setScreen('mirror')} className={pill(screen === 'mirror')}>
          3 Pitch mirror
        </button>
        <span className="ml-auto text-slate-500">Mockingbird MVP</span>
      </nav>
      <main>
        {screen === 'calibrate' && <Calibrate onDone={() => setScreen('ear')} />}
        {screen === 'ear' && (
          <EarTraining
            mode={earMode}
            onPick={(m) => setEarMode((current) => (current === m ? null : m))}
            onPitchMirror={() => setScreen('mirror')}
          />
        )}
        {screen === 'mirror' && (
          <PitchMirror onCalibrate={() => setScreen('calibrate')} />
        )}
      </main>
    </div>
  );
}

function pill(active: boolean) {
  return [
    'px-3 py-1 rounded-md transition',
    active ? 'bg-sky-700 text-white' : 'text-slate-400 hover:text-slate-100',
  ].join(' ');
}
