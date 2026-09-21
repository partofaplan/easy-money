import { describe, expect, it } from 'vitest';
import { activate, activeProfile, addProfile, emptyIndex, ProfileRegistry, removeProfile, renameProfile, PROFILES_KEY } from './profiles';

class MemoryStorage {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

describe('profile index', () => {
  it('adds, activates, renames and removes profiles', () => {
    const a = addProfile(emptyIndex, 'Zach', '2026-09-21T00:00:00Z');
    const b = addProfile(a.index, '  Sam ', '2026-09-21T00:00:01Z');
    expect(b.index.profiles.map((p) => p.name)).toEqual(['Zach', 'Sam']);
    expect(b.index.activeId).toBe(b.profile.id);
    const switched = activate(b.index, a.profile.id);
    expect(activeProfile(switched)?.name).toBe('Zach');
    expect(activate(switched, 'nope')).toBe(switched);
    expect(renameProfile(switched, a.profile.id, '   ')).toBe(switched);
    expect(activeProfile(renameProfile(switched, a.profile.id, 'Z'))?.name).toBe('Z');
    const removed = removeProfile(switched, a.profile.id);
    expect(removed.profiles).toHaveLength(1);
    expect(removed.activeId).toBe(b.profile.id);
    expect(removeProfile(removed, b.profile.id)).toEqual(emptyIndex);
  });

  it('falls back to a name when blank', () => {
    expect(addProfile(emptyIndex, '').profile.name).toBe('My budget');
  });
});

describe('ProfileRegistry', () => {
  it('adopts a budget saved before profiles existed', () => {
    const storage = new MemoryStorage();
    storage.setItem('easy-money.data', '{"version":3}');
    storage.setItem('easy-money.theme', 'dark');
    const registry = new ProfileRegistry(storage);
    const index = registry.load();
    expect(index.profiles).toHaveLength(1);
    expect(index.profiles[0].name).toBe('My budget');
    const id = index.profiles[0].id;
    expect(storage.getItem(`easy-money.data.${id}`)).toBe('{"version":3}');
    expect(storage.getItem(`easy-money.theme.${id}`)).toBe('dark');
    expect(storage.getItem('easy-money.data')).toBeNull();
    expect(JSON.parse(storage.getItem(PROFILES_KEY)!).activeId).toBe(id);
  });

  it('starts empty and round-trips', () => {
    const storage = new MemoryStorage();
    const registry = new ProfileRegistry(storage);
    expect(registry.load()).toEqual(emptyIndex);
    const { index, profile } = addProfile(emptyIndex, 'A');
    registry.save(index);
    expect(registry.load()).toEqual(index);
    storage.setItem(`easy-money.data.${profile.id}`, 'x');
    registry.purge(profile.id);
    expect(storage.getItem(`easy-money.data.${profile.id}`)).toBeNull();
  });
});
