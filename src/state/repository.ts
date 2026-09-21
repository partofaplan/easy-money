/**
 * Where app data is kept. The POC stores everything in the browser so the
 * flow can change freely; swapping in a server later means writing another
 * class with the same three methods.
 */
import type { AppData } from '../domain/types';

export interface Repository {
  load(): AppData | null;
  save(data: AppData): void;
  clear(): void;
}

const KEY = 'easy-money.data';

export class LocalStorageRepository implements Repository {
  load(): AppData | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AppData;
      return parsed.version === 1 ? parsed : null;
    } catch {
      return null;
    }
  }
  save(data: AppData): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      // Storage may be unavailable (private mode); the app keeps working in memory.
    }
  }
  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  }
}

export class MemoryRepository implements Repository {
  private data: AppData | null = null;
  load(): AppData | null {
    return this.data;
  }
  save(data: AppData): void {
    this.data = data;
  }
  clear(): void {
    this.data = null;
  }
}
