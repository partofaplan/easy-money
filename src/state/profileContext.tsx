import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { activate, activeProfile, addProfile, ProfileRegistry, removeProfile, renameProfile, type Profile, type ProfileIndex } from './profiles';

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

  const update = useCallback((next: ProfileIndex) => {
    registry.save(next);
    setIndex(next);
  }, []);

  const value = useMemo<ProfilesCtx>(
    () => ({
      profiles: index.profiles,
      active: activeProfile(index),
      create: (name) => {
        const { index: next, profile } = addProfile(index, name);
        update(next);
        return profile;
      },
      switchTo: (id) => update(activate(index, id)),
      rename: (id, name) => update(renameProfile(index, id, name)),
      remove: (id) => {
        registry.purge(id);
        update(removeProfile(index, id));
      },
    }),
    [index, update],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfiles(): ProfilesCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProfiles must be used inside ProfileProvider');
  return ctx;
}
