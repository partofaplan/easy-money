import { describe, expect, it } from 'vitest';
import { migrate } from './repository';

describe('migrate', () => {
  it('upgrades version 1 income events to dated, received events', () => {
    const v1 = {
      version: 1,
      setupComplete: true,
      answers: { nextPayday: '2026-09-26' },
      buckets: [],
      bills: [],
      reserves: [],
      incomeEvents: [
        { id: 'a', source: 'Acme', amount: 100, receivedOn: '2026-09-30', allocation: null },
        { id: 'b', source: 'Acme', amount: 50, receivedOn: '2026-09-29', allocation: { kind: 'paycheck' } },
      ],
    };
    const out = migrate(v1)!;
    expect(out.version).toBe(2);
    expect(out.incomeEvents[0]).toMatchObject({ date: '2026-09-30', status: 'received', allocation: null });
    expect(out.incomeEvents[1].allocation).toEqual({ kind: 'paycheck', payday: '2026-09-26' });
    expect(migrate(out)).toEqual(out);
  });

  it('rejects unknown shapes', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate({ version: 7 })).toBeNull();
  });
});
