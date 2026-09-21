import { describe, expect, it } from 'vitest';
import {
  bucketDueStatus,
  buildOutlook,
  dueDateInPeriod,
  fillFromPlan,
  planAssigned,
  planFor,
  takeHomeFor,
  extraTotalForPayday,
  horizonCount,
  nextPayday,
  payPeriods,
  periodForDate,
  suggestBuckets,
  suggestSmoothing,
  summarizePeriod,
} from './plan';
import { ordinalDay } from '../lib/dates';
import { DEMO_DATA, SAMPLE_BILLS as DEMO_BILLS } from '../data/fixtures';

// The demo models rent as a bucket with a due day; these tests keep it as a bill for the tightness cases.
const SAMPLE_BILLS = [
  ...DEMO_BILLS,
  { id: 'rent-oct', name: 'Rent', amount: 950, dueDate: '2026-10-01' },
  { id: 'rent-nov', name: 'Rent', amount: 950, dueDate: '2026-11-01' },
];

describe('nextPayday', () => {
  it('steps by frequency', () => {
    expect(nextPayday('2026-09-26', 'weekly')).toBe('2026-10-03');
    expect(nextPayday('2026-09-26', 'biweekly')).toBe('2026-10-10');
    expect(nextPayday('2026-09-30', 'monthly')).toBe('2026-10-30');
    expect(nextPayday('2026-01-31', 'monthly')).toBe('2026-02-28');
  });
  it('alternates 1st and 15th style for semimonthly', () => {
    expect(nextPayday('2026-10-01', 'semimonthly')).toBe('2026-10-16');
    expect(nextPayday('2026-10-16', 'semimonthly')).toBe('2026-11-01');
  });
});

describe('horizonCount', () => {
  it('shows one, three, or the rest of the month', () => {
    expect(horizonCount('this', 'biweekly', '2026-09-26')).toBe(1);
    expect(horizonCount('few', 'biweekly', '2026-09-26')).toBe(3);
    expect(horizonCount('month', 'biweekly', '2026-10-02')).toBe(3);
    expect(horizonCount('month', 'weekly', '2026-10-02')).toBe(5);
  });
});

describe('suggestBuckets', () => {
  it('spends the whole paycheck, rounding to tens', () => {
    const buckets = suggestBuckets(2140);
    const total = buckets.reduce((s, b) => s + b.planned, 0);
    expect(total).toBe(2140);
    expect(buckets.find((b) => b.id === 'housing')?.planned).toBe(940);
    expect(buckets.every((b) => b.id === 'other' || b.planned % 10 === 0)).toBe(true);
  });
});

describe('periods and smoothing', () => {
  const periods = payPeriods('2026-09-26', 'biweekly', 2140, 3);
  const summaries = periods.map((p) => summarizePeriod(p, SAMPLE_BILLS, [], []));

  it('places bills in the paycheck that pays them', () => {
    expect(summaries[0].bills.map((b) => b.name)).toEqual(['Rent', 'Phone']);
    expect(summaries[1].bills.map((b) => b.name)).toEqual(['Car insurance', 'Electric', 'Internet']);
    expect(summaries[2].bills.map((b) => b.name)).toEqual(['Credit card', 'Rent']);
  });

  it('flags the paycheck with rent and a card payment as tight', () => {
    expect(summaries.map((s) => s.status)).toEqual(['covered', 'covered', 'tight']);
  });

  it('suggests a round amount from earlier paychecks', () => {
    const s = suggestSmoothing(summaries);
    expect(s).not.toBeNull();
    expect(s?.forPayday).toBe('2026-10-24');
    // The first paycheck cannot spare its share without going tight itself, so only the second gives.
    expect(s?.fromPaydays).toEqual(['2026-10-10']);
    expect(s?.perPaycheck).toBe(120);
  });

  it('applying the reserve clears the tight paycheck', () => {
    const s = suggestSmoothing(summaries)!;
    const reserves = s.fromPaydays.map((from, i) => ({ id: String(i), fromPayday: from, forPayday: s.forPayday, amount: s.perPaycheck }));
    const after = periods.map((p) => summarizePeriod(p, SAMPLE_BILLS, reserves, []));
    expect(after.map((x) => x.status)).toEqual(['covered', 'covered', 'covered']);
  });
});

describe('planned bonuses', () => {
  const periods = payPeriods('2026-09-26', 'biweekly', 2140, 3);
  const bonus = { id: 'b1', source: 'Acme Co', amount: 800, date: '2026-10-15', status: 'expected' as const, allocation: null };

  it('finds the paycheck a date falls in', () => {
    expect(periodForDate(periods, '2026-10-15')?.payday).toBe('2026-10-10');
    expect(periodForDate(periods, '2026-12-01')).toBeNull();
  });

  it('counts a bonus only in the paycheck it was planned into', () => {
    const planned = { ...bonus, allocation: { kind: 'paycheck' as const, payday: '2026-10-24' } };
    const summaries = periods.map((p) => summarizePeriod(p, SAMPLE_BILLS, [], [planned]));
    expect(summaries.map((s) => s.extraTotal)).toEqual([0, 0, 800]);
    expect(summaries[2].leftForBuckets).toBe(2140 + 800 - 1190);
    expect(summaries[2].status).toBe('covered');
  });

  it('ignores expected money that has not been planned yet', () => {
    const summaries = periods.map((p) => summarizePeriod(p, SAMPLE_BILLS, [], [bonus]));
    expect(summaries.every((s) => s.extraTotal === 0)).toBe(true);
    expect(extraTotalForPayday([bonus], '2026-09-26')).toBe(0);
  });

  it('counts every decision tied to the paycheck except debt, in Home and Ahead alike', () => {
    const events = [
      { ...bonus, id: 's', status: 'received' as const, allocation: { kind: 'savings' as const, payday: '2026-09-26' } },
      { ...bonus, id: 'd', status: 'received' as const, allocation: { kind: 'debt' as const, payday: '2026-09-26' } },
      { ...bonus, id: 'p', allocation: { kind: 'paycheck' as const, payday: '2026-09-26' } },
      { ...bonus, id: 'later', allocation: { kind: 'paycheck' as const, payday: '2026-10-10' } },
    ];
    expect(extraTotalForPayday(events, '2026-09-26')).toBe(1600);
    expect(extraTotalForPayday(events, null)).toBe(0);
    const first = summarizePeriod(periods[0], SAMPLE_BILLS, [], events);
    expect(first.extraTotal).toBe(1600);
  });
});

describe('bucket due dates', () => {
  const [p1, p2, p3] = payPeriods('2026-09-26', 'biweekly', 2140, 3);
  const rent = { id: 'housing', name: 'Rent & housing', planned: 950, defaultAmount: 950, spent: 0, kind: 'spending' as const, dueDay: 1 };

  it('finds the due date inside the paycheck that contains it', () => {
    expect(dueDateInPeriod(1, p1)).toBe('2026-10-01');
    expect(dueDateInPeriod(1, p2)).toBeNull();
    expect(dueDateInPeriod(1, p3)).toBe('2026-11-01');
    expect(dueDateInPeriod(15, p2)).toBe('2026-10-15');
    expect(dueDateInPeriod(undefined, p1)).toBeNull();
    // Monthly pay with the due day before payday: the due date is in the following month.
    expect(dueDateInPeriod(10, { payday: '2026-10-15', end: '2026-11-14', takeHome: 0 })).toBe('2026-11-10');
    // A one-week paycheck that skips the due day entirely.
    expect(dueDateInPeriod(20, { payday: '2026-10-05', end: '2026-10-11', takeHome: 0 })).toBeNull();
  });

  it('clamps the 31st to the last day of short months', () => {
    const feb = { payday: '2026-02-20', end: '2026-03-05', takeHome: 0 };
    expect(dueDateInPeriod(31, feb)).toBe('2026-02-28');
  });

  it('reports due, paid and overdue', () => {
    expect(bucketDueStatus(rent, p1, '2026-09-27')).toEqual({ dueOn: '2026-10-01', paid: false, overdue: false });
    expect(bucketDueStatus(rent, p1, '2026-10-03')).toEqual({ dueOn: '2026-10-01', paid: false, overdue: true });
    expect(bucketDueStatus({ ...rent, spent: 950 }, p1, '2026-10-03')).toEqual({ dueOn: '2026-10-01', paid: true, overdue: false });
    expect(bucketDueStatus(rent, p2, '2026-10-12')).toBeNull();
  });

  it('treats a due date marked paid by hand as paid, for that date only', () => {
    expect(bucketDueStatus({ ...rent, paidOn: '2026-10-01' }, p1, '2026-10-03')).toMatchObject({ paid: true, overdue: false });
    expect(bucketDueStatus({ ...rent, paidOn: '2026-10-01' }, p3, '2026-11-02')).toMatchObject({ dueOn: '2026-11-01', paid: false, overdue: true });
  });

  it('formats ordinals', () => {
    expect(['1', '2', '3', '4', '11', '12', '13', '21', '22', '23', '31'].map((d) => ordinalDay(Number(d)))).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', 'last day',
    ]);
  });
});

describe('paycheck plans', () => {
  const { answers, buckets, plans, deposit } = DEMO_DATA;

  it('uses what landed, then the plan, then the setup default for take-home', () => {
    expect(takeHomeFor('2026-09-26', answers, plans, deposit)).toBe(2140);
    expect(takeHomeFor('2026-10-10', { ...answers, paycheckAmount: 1000 }, plans, deposit)).toBe(2140);
    expect(takeHomeFor('2026-10-24', { ...answers, paycheckAmount: 1000 }, plans, deposit)).toBe(1000);
    expect(takeHomeFor('2026-09-26', answers, plans, { payday: '2026-09-26', amount: 2200 })).toBe(2200);
  });

  it('builds a default plan from bucket amounts and keeps a stored one', () => {
    const fresh = planFor('2026-10-24', plans, buckets, answers);
    expect(fresh.takeHome).toBe(2140);
    expect(fresh.allocations.housing).toBe(950);
    expect(planAssigned(fresh, buckets)).toBe(2140);
    const stored = planFor('2026-10-10', plans, buckets, answers);
    expect(stored.allocations.bills).toBe(360);
    expect(planAssigned(stored, buckets)).toBe(2140);
  });

  it('fills buckets from a plan; a bucket the plan does not mention uses its default', () => {
    const filled = fillFromPlan(buckets, { payday: 'x', takeHome: 500, allocations: { groceries: 500, fun: 0 } });
    expect(filled.find((b) => b.id === 'groceries')?.planned).toBe(500);
    expect(filled.find((b) => b.id === 'fun')?.planned).toBe(0);
    expect(filled.find((b) => b.id === 'housing')?.planned).toBe(950);
    expect(filled.find((b) => b.id === 'housing')?.spent).toBe(950);
  });

  it('starts new plans from the default amount, not the current fill', () => {
    const bumped = buckets.map((b) => (b.id === 'savings' ? { ...b, planned: 1500 } : b));
    expect(planFor('2026-10-24', plans, bumped, answers).allocations.savings).toBe(300);
  });

  it('gives each upcoming paycheck its planned take-home', () => {
    const outlook = buildOutlook({ answers: { ...answers, paycheckAmount: 2000 }, bills: [], reserves: [], events: [], plans, deposit, extra: 1 });
    expect(outlook.map((s) => s.period.takeHome)).toEqual([2140, 2140, 2000, 2000]);
  });
});
