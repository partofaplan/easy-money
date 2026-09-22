/**
 * Where one profile's budget is kept. Local mode uses the browser;
 * cloud mode uses Firestore (see cloud/firestoreStores.ts). Both implement
 * the same three methods.
 */
import type { AppData, BonusAllocation } from '../domain/types';

export interface Repository {
  load(): Promise<AppData | null>;
  save(data: AppData): Promise<void>;
  clear(): Promise<void>;
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
  if (data.version === 3) data = v3ToV4(data as V3Data);
  return data.version === 4 ? (data as AppData) : null;
}

type V1Event = { id: string; source: string; amount: number; receivedOn: string; allocation: { kind: BonusAllocation['kind'] } | null };
type V1Data = Omit<V2Data, 'version' | 'incomeEvents'> & { version: 1; incomeEvents: V1Event[] };
type V3Answers = Omit<AppData['answers'], 'payType' | 'hourlyRate' | 'typicalHours' | 'tax'>;
type V3Data = Omit<AppData, 'version' | 'answers'> & { version: 3; answers: V3Answers };
type V2Bucket = Omit<AppData['buckets'][number], 'defaultAmount'>;
type V2Data = Omit<V3Data, 'version' | 'plans' | 'deposit' | 'extraPlanned' | 'buckets'> & { version: 2; buckets: V2Bucket[]; reserves?: unknown[] };

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
function v2ToV3(v2: V2Data): V3Data {
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

/** v4 adds the pay type (salary or hourly) and saved tax settings. Everyone before was on a salary. */
function v3ToV4(v3: V3Data): AppData {
  return {
    ...v3,
    version: 4,
    answers: { ...v3.answers, payType: 'salary', hourlyRate: null, typicalHours: null, tax: null },
  };
}

/** Migrates stored data, refusing (rather than discarding) anything unrecognised. */
export function parseStored(raw: unknown): AppData {
  const data = migrate(raw);
  if (!data) throw new Error('This budget was saved by a newer version of the app. Update the app to open it.');
  return data;
}

export class LocalStorageRepository implements Repository {
  /** @param key the storage key this profile's budget lives under */
  constructor(private readonly key: string) {}

  async load(): Promise<AppData | null> {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(this.key);
    } catch {
      return null; // storage unavailable: start in memory
    }
    if (!raw) return null;
    return parseStored(JSON.parse(raw));
  }
  async save(data: AppData): Promise<void> {
    try {
      localStorage.setItem(this.key, JSON.stringify(data));
    } catch {
      // Storage may be unavailable (private mode); the app keeps working in memory.
    }
  }
  async clear(): Promise<void> {
    try {
      localStorage.removeItem(this.key);
    } catch {
      // ignore
    }
  }
}

export class MemoryRepository implements Repository {
  private data: AppData | null = null;
  async load(): Promise<AppData | null> {
    return this.data;
  }
  async save(data: AppData): Promise<void> {
    this.data = data;
  }
  async clear(): Promise<void> {
    this.data = null;
  }
}
