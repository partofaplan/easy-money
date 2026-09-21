import { describe, expect, it } from 'vitest';
import {
  bucketDueStatus,
  dueDateInPeriod,
  paychecksPerMonth,
  projectFunding,
  suggestedSetAside,
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
import { SAMPLE_BILLS as DEMO_BILLS } from '../data/fixtures';

// The demo no longer lists rent as a bill (it is an envelope now); these tests keep it for tightness.
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
  const rent = { id: 'housing', name: 'Rent & housing', planned: 950, spent: 0, kind: 'spending' as const, dueDay: 1 };

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

describe('saving for a monthly bill across paychecks', () => {
  const periods = payPeriods('2026-09-26', 'biweekly', 2140, 3);
  const rent = { id: 'housing', name: 'Rent', planned: 950, spent: 0, kind: 'spending' as const, dueDay: 1, monthlyTarget: 1900, fundOver: 2, balance: 950 };

  it('knows how many paychecks a month holds', () => {
    expect(paychecksPerMonth('weekly')).toBe(4);
    expect(paychecksPerMonth('biweekly')).toBe(2);
    expect(paychecksPerMonth('semimonthly')).toBe(2);
    expect(paychecksPerMonth('monthly')).toBe(1);
    expect(suggestedSetAside(1900, 2)).toBe(950);
    expect(suggestedSetAside(1000, 3)).toBe(334);
  });

  it('fills the envelope each payday and pays it out on the due date', () => {
    const steps = projectFunding(rent, periods);
    expect(steps.map((s) => [s.ready, s.dueOn, s.short, s.carried])).toEqual([
      [1900, '2026-10-01', 0, 0],
      [950, null, 0, 950],
      [1900, '2026-11-01', 0, 0],
    ]);
  });

  it('flags a shortfall when the envelope will not be full by the due date', () => {
    const steps = projectFunding({ ...rent, balance: 0 }, periods);
    expect(steps[0]).toMatchObject({ ready: 950, short: 950, carried: 0 });
    expect(steps[2]).toMatchObject({ ready: 1900, short: 0 });
  });

  it('does not count a bill already paid this paycheck as short', () => {
    const steps = projectFunding({ ...rent, balance: 0, spent: 1900 }, periods);
    expect(steps[0].short).toBe(0);
  });

  it('marks the envelope paid once spending reaches the monthly amount, not the set-aside', () => {
    const p1 = periods[0];
    expect(bucketDueStatus({ ...rent, spent: 950 }, p1, '2026-09-27')?.paid).toBe(false);
    expect(bucketDueStatus({ ...rent, spent: 1900 }, p1, '2026-09-27')?.paid).toBe(true);
  });
});
