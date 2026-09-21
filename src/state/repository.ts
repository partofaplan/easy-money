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

/** Bring older stored data up to the current shape. Returns null if it cannot. */
export function migrate(raw: unknown): AppData | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as { version?: number };
  if (data.version === 2) return raw as AppData;
  if (data.version === 1) {
    type V1Event = { id: string; source: string; amount: number; receivedOn: string; allocation: { kind: string } | null };
    const v1 = raw as Omit<AppData, 'version' | 'incomeEvents'> & { incomeEvents: V1Event[] };
    const currentPayday = v1.answers?.nextPayday ?? '';
    return {
      ...v1,
      version: 2,
      incomeEvents: (v1.incomeEvents ?? []).map((e) => ({
        id: e.id,
        source: e.source,
        amount: e.amount,
        date: e.receivedOn,
        status: 'received',
        allocation: e.allocation?.kind === 'paycheck' ? { kind: 'paycheck', payday: currentPayday } : (e.allocation as AppData['incomeEvents'][number]['allocation']),
      })),
    };
  }
  return null;
}

export class LocalStorageRepository implements Repository {
  load(): AppData | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return migrate(JSON.parse(raw));
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
