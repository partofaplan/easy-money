/**
 * Where app data is kept. The POC stores everything in the browser so the
 * flow can change freely; swapping in a server later means writing another
 * class with the same three methods.
 */
import type { AppData, BonusAllocation } from '../domain/types';

export interface Repository {
  load(): AppData | null;
  save(data: AppData): void;
  clear(): void;
}


/**
 * Bring older stored data up to the current shape, one version at a time.
 * Returns null for anything it does not recognise.
 */
export function migrate(raw: unknown): AppData | null {
  if (!raw || typeof raw !== 'object') return null;
  let data = raw as { version?: number };
  if (data.version === 1) data = v1ToV2(data as V1Data);
  if (data.version === 2) data = v2ToV3(data as V2Data);
  return data.version === 3 ? (data as AppData) : null;
}

type V1Event = { id: string; source: string; amount: number; receivedOn: string; allocation: { kind: BonusAllocation['kind'] } | null };
type V1Data = Omit<V2Data, 'version' | 'incomeEvents'> & { version: 1; incomeEvents: V1Event[] };
type V2Bucket = Omit<AppData['buckets'][number], 'defaultAmount'>;
type V2Data = Omit<AppData, 'version' | 'plans' | 'deposit' | 'extraPlanned' | 'buckets'> & { version: 2; buckets: V2Bucket[]; reserves?: unknown[] };

/** v1 events had only a received date; every decision now names the paycheck it counts in. */
function v1ToV2(v1: V1Data): V2Data {
  const payday = v1.answers?.nextPayday ?? '';
  return {
    ...v1,
    version: 2,
    incomeEvents: (v1.incomeEvents ?? []).map((e) => ({
      id: e.id,
      source: e.source,
      amount: e.amount,
      date: e.receivedOn,
      status: 'received',
      allocation: e.allocation ? { kind: e.allocation.kind, payday } : null,
    })),
  };
}

/**
 * v3 adds per-paycheck plans, the confirmed deposit and a per-bucket default
 * amount; the short-lived envelope fields and paycheck reserves are dropped.
 */
function v2ToV3(v2: V2Data): AppData {
  const { reserves: _dropped, ...rest } = v2;
  return {
    ...rest,
    version: 3,
    buckets: v2.buckets.map(({ id, name, planned, spent, kind, dueDay, paidOn }) => ({ id, name, planned, defaultAmount: planned, spent, kind, dueDay, paidOn })),
    plans: [],
    deposit: null,
    extraPlanned: 0,
  };
}

export class LocalStorageRepository implements Repository {
  /** @param key the storage key this profile's budget lives under */
  constructor(private readonly key: string) {}

  load(): AppData | null {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      return migrate(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  save(data: AppData): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(data));
    } catch {
      // Storage may be unavailable (private mode); the app keeps working in memory.
    }
  }
  clear(): void {
    try {
      localStorage.removeItem(this.key);
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
