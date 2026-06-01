import { useCallback, useEffect, useState } from 'react';

import type { VoiceInfo } from '../../../../core/domain/tones.js';
import { useContainer } from '../../../../composition/ReactContainer.js';

export function usePreferences(): {
  voices: VoiceInfo[];
  selectedVoiceId: string | null;
  setVoice: (id: string | null) => void;
} {
  const { preferences, voices } = useContainer();
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void preferences.load().then((p) => {
      if (active) setSelectedVoiceId(p.selectedVoiceId);
    });
    return () => {
      active = false;
    };
  }, [preferences]);

  const setVoice = useCallback(
    (id: string | null) => {
      setSelectedVoiceId(id);
      void preferences.save({ selectedVoiceId: id });
    },
    [preferences],
  );

  return { voices, selectedVoiceId, setVoice };
}
