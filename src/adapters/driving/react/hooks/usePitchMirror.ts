import { useCallback, useEffect, useRef, useState } from 'react';

import type { Calibration } from '../../../../core/domain/calibration.js';
import type { Verdict } from '../../../../core/domain/scoring.js';
import type { ContourPoint } from '../../../../core/domain/tones.js';
import type { PitchSample } from '../../../../core/ports/driven/PitchDetector.js';
import type {
  PitchMirrorItem,
  SessionSummary,
} from '../../../../core/ports/driving/PitchMirrorSession.js';
import { useContainer } from '../../../../composition/ReactContainer.js';

type Status = 'init' | 'noCalibration' | 'ready' | 'recording' | 'pass' | 'retry';

export type LiveBuffer = { samples: PitchSample[] };

export function usePitchMirror() {
  const { pitchMirror } = useContainer();
  const [status, setStatus] = useState<Status>('init');
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const [current, setCurrent] = useState<PitchMirrorItem | null>(null);
  const [target, setTarget] = useState<ContourPoint[]>([]);
  const [stats, setStats] = useState<SessionSummary>({ attempts: 0, passes: 0, rotations: 0 });
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const liveBufferRef = useRef<PitchSample[]>([]);
  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    void (async () => {
      const res = await pitchMirror.init();
      if (!res.ok) {
        setStatus('noCalibration');
        return;
      }
      setCalibration(res.value);
      setCurrent(pitchMirror.current());
      setTarget(pitchMirror.target());
      setStatus('ready');
    })();
  }, [pitchMirror]);

  const start = useCallback(async () => {
    liveBufferRef.current = [];
    const res = await pitchMirror.start();
    if (!res.ok) {
      setStatus('retry');
      return;
    }
    setStatus('recording');
  }, [pitchMirror]);

  const stop = useCallback(() => {
    const v = pitchMirror.stop();
    setVerdict(v);
    setStatus(v.pass ? 'pass' : 'retry');
    window.setTimeout(() => {
      pitchMirror.advance();
      setCurrent(pitchMirror.current());
      setTarget(pitchMirror.target());
      setStats(pitchMirror.stats());
      setStatus('ready');
      setVerdict(null);
      liveBufferRef.current = [];
    }, v.pass ? 700 : 1100);
  }, [pitchMirror]);

  useEffect(() => {
    const unsub = pitchMirror.onLiveSample((s) => {
      liveBufferRef.current = [...liveBufferRef.current, s].slice(-200);
    });
    return unsub;
  }, [pitchMirror]);

  return {
    status,
    calibration,
    current,
    target,
    stats,
    verdict,
    liveBufferRef,
    start,
    stop,
  };
}
