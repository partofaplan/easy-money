import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { activate, activeProfile, addProfile, emptyIndex, ProfileRegistry, removeProfile, renameProfile, type Profile, type ProfileIndex } from './profiles';

interface ProfilesCtx {
  profiles: Profile[];
  active: Profile | null;
  create: (name: string) => Profile;
  switchTo: (id: string) => void;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
}

const Ctx = createContext<ProfilesCtx | null>(null);

const registry = new ProfileRegistry();

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState<ProfileIndex>(() => registry.load());

  // Persist whatever the latest index is, however it got there.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    registry.save(index);
  }, [index]);

  // Every action works from the latest index, so two changes in one tick both land.
  const create = useCallback((name: string) => {
    const { profile } = addProfile(emptyIndex, name);
    setIndex((prev) => ({ profiles: [...prev.profiles, profile], activeId: profile.id }));
    return profile;
  }, []);
  const switchTo = useCallback((id: string) => setIndex((prev) => activate(prev, id)), []);
  const rename = useCallback((id: string, name: string) => setIndex((prev) => renameProfile(prev, id, name)), []);
  const remove = useCallback((id: string) => {
    registry.purge(id);
    setIndex((prev) => removeProfile(prev, id));
  }, []);

  const value = useMemo<ProfilesCtx>(
    () => ({ profiles: index.profiles, active: activeProfile(index), create, switchTo, rename, remove }),
    [index, create, switchTo, rename, remove],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfiles(): ProfilesCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProfiles must be used inside ProfileProvider');
  return ctx;
}
