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
    expect(out.version).toBe(5);
    expect(out.answers.payType).toBe('salary');
    expect(out.answers.semimonthlyDays).toBeNull();
    expect(out.plans).toEqual([]);
    expect(out.deposit).toBeNull();
    expect('reserves' in out).toBe(false);
    expect(out.incomeEvents[0]).toMatchObject({ date: '2026-09-30', status: 'received', allocation: null });
    expect(out.incomeEvents[1].allocation).toEqual({ kind: 'paycheck', payday: '2026-09-26' });
    expect(migrate(out)).toEqual(out);
  });

  it('rejects unknown shapes', () => {
    expect(migrate(null)).toBeNull();
    const v2 = { version: 2, buckets: [{ id: 'a', name: 'A', planned: 1, spent: 0, kind: 'spending', monthlyTarget: 5, balance: 2 }], incomeEvents: [], answers: {} };
    const out = migrate(v2)!;
    expect(out.version).toBe(5);
    expect(out.buckets[0]).toEqual({ id: 'a', name: 'A', planned: 1, defaultAmount: 1, spent: 0, kind: 'spending', dueDay: undefined, paidOn: undefined });
    expect(migrate({ version: 7 })).toBeNull();
  });
});

describe('migrate: twice-a-month pay days', () => {
  const v4 = (nextPayday: string, payFrequency = 'semimonthly') => ({
    version: 4,
    setupComplete: true,
    answers: { payFrequency, nextPayday, payType: 'salary' },
    buckets: [],
    bills: [],
    incomeEvents: [],
    plans: [],
    deposit: null,
    extraPlanned: 0,
  });

  it('keeps a month-end payday on the 15th-and-last-day pattern', () => {
    expect(migrate(v4('2026-09-30'))!.answers.semimonthlyDays).toEqual([15, 31]);
    expect(migrate(v4('2026-10-31'))!.answers.semimonthlyDays).toEqual([15, 31]);
  });

  it('leaves everyone else on the default', () => {
    expect(migrate(v4('2026-10-15'))!.answers.semimonthlyDays).toBeNull();
    expect(migrate(v4('2026-10-01'))!.answers.semimonthlyDays).toBeNull();
    expect(migrate(v4('2026-09-30', 'biweekly'))!.answers.semimonthlyDays).toBeNull();
  });
});
