/**
 * User profiles. Each profile owns its own budget data and settings, kept
 * under profile-specific keys in the browser. Pure helpers operate on the
 * index; ProfileRegistry reads and writes it.
 */
import { newId } from '../lib/money';

export interface Profile {
  id: string;
  name: string;
  /** ISO timestamp */
  createdAt: string;
}

export interface ProfileIndex {
  profiles: Profile[];
  activeId: string | null;
}

export const PROFILES_KEY = 'easy-money.profiles';
const LEGACY_DATA_KEY = 'easy-money.data';
const LEGACY_THEME_KEY = 'easy-money.theme';

export const dataKey = (profileId: string) => `easy-money.data.${profileId}`;
export const themeKey = (profileId: string) => `easy-money.theme.${profileId}`;

export const emptyIndex: ProfileIndex = { profiles: [], activeId: null };

export function addProfile(index: ProfileIndex, name: string, now = new Date().toISOString()): { index: ProfileIndex; profile: Profile } {
  const profile: Profile = { id: newId('user'), name: name.trim() || 'My budget', createdAt: now };
  return { index: { profiles: [...index.profiles, profile], activeId: profile.id }, profile };
}

export function renameProfile(index: ProfileIndex, id: string, name: string): ProfileIndex {
  const trimmed = name.trim();
  if (!trimmed) return index;
  return { ...index, profiles: index.profiles.map((p) => (p.id === id ? { ...p, name: trimmed } : p)) };
}

export function activate(index: ProfileIndex, id: string): ProfileIndex {
  return index.profiles.some((p) => p.id === id) ? { ...index, activeId: id } : index;
}

/** Remove a profile. If it was active, the first remaining profile becomes active. */
export function removeProfile(index: ProfileIndex, id: string): ProfileIndex {
  const profiles = index.profiles.filter((p) => p.id !== id);
  const activeId = index.activeId === id ? (profiles[0]?.id ?? null) : index.activeId;
  return { profiles, activeId };
}

export function activeProfile(index: ProfileIndex): Profile | null {
  return index.profiles.find((p) => p.id === index.activeId) ?? null;
}

interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class ProfileRegistry {
  constructor(private readonly storage: KeyValueStore | null = safeLocalStorage()) {}

  load(): ProfileIndex {
    if (!this.storage) return emptyIndex;
    try {
      const raw = this.storage.getItem(PROFILES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ProfileIndex;
        if (Array.isArray(parsed.profiles)) return { profiles: parsed.profiles, activeId: parsed.activeId ?? null };
      }
      return this.adoptLegacy();
    } catch {
      return emptyIndex;
    }
  }

  save(index: ProfileIndex): void {
    try {
      this.storage?.setItem(PROFILES_KEY, JSON.stringify(index));
    } catch {
      // Storage unavailable; the app keeps working in memory.
    }
  }

  /** Delete everything a profile stored. */
  purge(profileId: string): void {
    try {
      this.storage?.removeItem(dataKey(profileId));
      this.storage?.removeItem(themeKey(profileId));
    } catch {
      // ignore
    }
  }

  /**
   * Budgets saved before profiles existed live under one unkeyed entry. Turn
   * that into the first profile so nothing is lost.
   */
  private adoptLegacy(): ProfileIndex {
    if (!this.storage) return emptyIndex;
    const data = this.storage.getItem(LEGACY_DATA_KEY);
    if (!data) return emptyIndex;
    const { index, profile } = addProfile(emptyIndex, 'My budget');
    this.storage.setItem(dataKey(profile.id), data);
    this.storage.removeItem(LEGACY_DATA_KEY);
    const theme = this.storage.getItem(LEGACY_THEME_KEY);
    if (theme) {
      this.storage.setItem(themeKey(profile.id), theme);
      this.storage.removeItem(LEGACY_THEME_KEY);
    }
    this.save(index);
    return index;
  }
}

function safeLocalStorage(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
