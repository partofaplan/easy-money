import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { activate, activeProfile, addProfile, emptyIndex, removeProfile, renameProfile, type Profile, type ProfileIndex, type ProfileStore } from './profiles';

interface ProfilesCtx {
  /** False until the profile list has loaded. */
  ready: boolean;
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

  useEffect(() => {
    let cancelled = false;
    store.load().then((loaded) => {
      if (cancelled) return;
      setIndex(loaded);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [store]);

  // Persist whatever the latest index is, however it got there, once loaded.
  const loadedOnce = useRef(false);
  useEffect(() => {
    if (!ready) return;
    if (!loadedOnce.current) {
      loadedOnce.current = true;
      return;
    }
    void store.save(index);
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
      void store.purge(id);
      setIndex((prev) => removeProfile(prev, id));
    },
    [store],
  );

  const value = useMemo<ProfilesCtx>(
    () => ({ ready, profiles: index.profiles, active: activeProfile(index), create, switchTo, rename, remove }),
    [ready, index, create, switchTo, rename, remove],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfiles(): ProfilesCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProfiles must be used inside ProfileProvider');
  return ctx;
}
