import type {
  Preferences,
  PreferencesRepository,
} from '../../../core/ports/driven/PreferencesRepository.js';

const KEY = 'mockingbird:preferences';
const EMPTY: Preferences = { selectedVoiceId: null };

export function createLocalStoragePreferencesRepository(): PreferencesRepository {
  return {
    async load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return EMPTY;
        const parsed = JSON.parse(raw) as Partial<Preferences>;
        return {
          selectedVoiceId:
            typeof parsed.selectedVoiceId === 'string' ? parsed.selectedVoiceId : null,
        };
      } catch {
        return EMPTY;
      }
    },
    async save(prefs) {
      try {
        localStorage.setItem(KEY, JSON.stringify(prefs));
      } catch {
        /* localStorage disabled (private mode etc.); silently no-op */
      }
    },
  };
}
