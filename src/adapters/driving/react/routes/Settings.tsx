import { usePreferences } from '../hooks/usePreferences.js';
import { VoicePicker } from '../components/VoicePicker.js';

export function Settings() {
  const { voices, selectedVoiceId, setVoice } = usePreferences();

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      <section className="space-y-3">
        <div>
          <h2 className="font-medium">Ear-training voice</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Pick a speaker, or leave on Auto to hear more voices as you advance.
          </p>
        </div>
        <VoicePicker voices={voices} selectedVoiceId={selectedVoiceId} onSelect={setVoice} />
      </section>
    </div>
  );
}
