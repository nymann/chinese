import { useState } from 'react';

import { Calibrate } from './adapters/driving/react/routes/Calibrate.js';
import { EarTraining } from './adapters/driving/react/routes/EarTraining.js';
import { PitchMirror } from './adapters/driving/react/routes/PitchMirror.js';

type Screen = 'same-different' | 'which-tone' | 'mirror' | 'calibrate';

export function App() {
  const [screen, setScreen] = useState<Screen>('same-different');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <nav className="border-b border-slate-200 dark:border-slate-800 p-2 sm:p-3 flex flex-wrap gap-1.5 sm:gap-2 text-xs sm:text-sm items-center">
        <button
          onClick={() => setScreen('same-different')}
          className={pill(screen === 'same-different')}
        >
          1 Same or different?
        </button>
        <button
          onClick={() => setScreen('which-tone')}
          className={pill(screen === 'which-tone')}
        >
          2 Which tone?
        </button>
        <button
          onClick={() => setScreen('mirror')}
          className={pill(screen === 'mirror')}
        >
          3 Pitch mirror
          <BetaBadge />
        </button>
        <span className="hidden sm:inline ml-auto text-slate-500">Mockingbird MVP</span>
      </nav>
      <main>
        {screen === 'same-different' && <EarTraining mode="discrimination" />}
        {screen === 'which-tone' && <EarTraining mode="identification" />}
        {screen === 'mirror' && (
          <PitchMirror onCalibrate={() => setScreen('calibrate')} />
        )}
        {screen === 'calibrate' && (
          <Calibrate onDone={() => setScreen('mirror')} />
        )}
      </main>
    </div>
  );
}

function pill(active: boolean) {
  return [
    'px-2.5 sm:px-3 py-1 rounded-md transition',
    active
      ? 'bg-sky-700 text-white'
      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100',
  ].join(' ');
}

function BetaBadge() {
  return (
    <span className="ml-1.5 text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 align-middle">
      beta
    </span>
  );
}
