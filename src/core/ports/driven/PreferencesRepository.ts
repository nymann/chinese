export type Preferences = {
  /** Pinned ear-training voice id, or null for adaptive ("Auto"). */
  selectedVoiceId: string | null;
};

export interface PreferencesRepository {
  load(): Promise<Preferences>;
  save(prefs: Preferences): Promise<void>;
}
