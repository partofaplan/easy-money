import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushPendingSaves } from './pendingSaves';
import { activate, activeProfile, addProfile, emptyIndex, removeProfile, renameProfile, type Profile, type ProfileIndex, type ProfileStore } from './profiles';

interface ProfilesCtx {
  /** False until the profile list has loaded. */
  ready: boolean;
  /** Set when the list could not be loaded or saved. */
  error: string | null;
  retry: () => void;
  profiles: Profile[];
  active: Profile | null;
  create: (name: string) => Profile;
  switchTo: (id: string) => void;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
}

const Ctx = createContext<ProfilesCtx | null>(null);

export function ProfileProvider({ children, store }: { children: ReactNode; store: ProfileStore }) {
  const [index, setIndex] = useState<ProfileIndex>(emptyIndex);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    store
      .load()
      .then((loaded) => {
        if (cancelled) return;
        setIndex(loaded);
        setError(null);
        setReady(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('Loading profiles failed', err);
        setError('Could not load your profiles. Check your connection and try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [store, attempt]);

  // Persist whatever the latest index is, however it got there, once loaded.
  const loadedOnce = useRef(false);
  useEffect(() => {
    if (!ready) return;
    if (!loadedOnce.current) {
      loadedOnce.current = true;
      return;
    }
    store.save(index).catch((err: unknown) => {
      console.error('Saving profiles failed', err);
      setError('Your profile change could not be saved. Check your connection.');
    });
  }, [index, ready, store]);

  // Every action works from the latest index, so two changes in one tick both land.
  const create = useCallback((name: string) => {
    const { profile } = addProfile(emptyIndex, name);
    setIndex((prev) => ({ profiles: [...prev.profiles, profile], activeId: profile.id }));
    return profile;
  }, []);
  const switchTo = useCallback((id: string) => setIndex((prev) => activate(prev, id)), []);
  const rename = useCallback((id: string, name: string) => setIndex((prev) => renameProfile(prev, id, name)), []);
  const remove = useCallback(
    (id: string) => {
      // Write anything pending first so the unmounting budget cannot recreate the deleted document.
      void flushPendingSaves()
        .then(() => store.purge(id))
        .catch((err: unknown) => console.error('Deleting the profile budget failed', err));
      setIndex((prev) => removeProfile(prev, id));
    },
    [store],
  );
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const value = useMemo<ProfilesCtx>(
    () => ({ ready, error, retry, profiles: index.profiles, active: activeProfile(index), create, switchTo, rename, remove }),
    [ready, error, retry, index, create, switchTo, rename, remove],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfiles(): ProfilesCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProfiles must be used inside ProfileProvider');
  return ctx;
}
