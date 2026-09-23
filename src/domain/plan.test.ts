import { describe, expect, it } from 'vitest';
import {
  bucketAvailable,
  bucketDueStatus,
  carryBalances,
  carryOver,
  buildOutlook,
  dueDateInPeriod,
  fillFromPlan,
  planAssigned,
  planFor,
  takeHomeFor,
  takeHomeForHours,
  extraTotalForPayday,
  horizonCount,
  isSemimonthlyPayday,
  nextPayday,
  semimonthlyPaydaysFrom,
  payPeriods,
  periodForDate,
  suggestBuckets,
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
  it('follows the 1st-and-15th pattern by default', () => {
    expect(nextPayday('2026-10-01', 'semimonthly')).toBe('2026-10-15');
    expect(nextPayday('2026-10-15', 'semimonthly')).toBe('2026-11-01');
    // A payday that is not on the pattern still moves to the next pattern day.
    expect(nextPayday('2026-10-16', 'semimonthly')).toBe('2026-11-01');
  });

  it('handles the 15th and the last day of the month', () => {
    const days: [number, number] = [15, 31];
    expect(nextPayday('2026-09-15', 'semimonthly', days)).toBe('2026-09-30');
    expect(nextPayday('2026-09-30', 'semimonthly', days)).toBe('2026-10-15');
    expect(nextPayday('2026-10-15', 'semimonthly', days)).toBe('2026-10-31');
    expect(nextPayday('2026-10-31', 'semimonthly', days)).toBe('2026-11-15');
    expect(nextPayday('2026-01-31', 'semimonthly', days)).toBe('2026-02-15');
    expect(nextPayday('2026-02-15', 'semimonthly', days)).toBe('2026-02-28');
    expect(nextPayday('2026-02-28', 'semimonthly', days)).toBe('2026-03-15');
    expect(isSemimonthlyPayday('2026-02-28', days)).toBe(true);
    expect(isSemimonthlyPayday('2026-02-27', days)).toBe(false);
    expect(semimonthlyPaydaysFrom('2026-09-21', days, 3)).toEqual(['2026-09-30', '2026-10-15', '2026-10-31']);
  });

  it('accepts two custom days, in either order', () => {
    expect(nextPayday('2026-10-05', 'semimonthly', [20, 5])).toBe('2026-10-20');
    expect(nextPayday('2026-10-20', 'semimonthly', [20, 5])).toBe('2026-11-05');
    expect(horizonCount('month', 'semimonthly', '2026-10-05', [20, 5])).toBe(2);
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

describe('periods and bills', () => {
  const periods = payPeriods('2026-09-26', 'biweekly', 2140, 3);
  const summaries = periods.map((p) => summarizePeriod(p, SAMPLE_BILLS, []));

  it('places bills in the paycheck that pays them', () => {
    expect(summaries[0].bills.map((b) => b.name)).toEqual(['Rent', 'Phone']);
    expect(summaries[1].bills.map((b) => b.name)).toEqual(['Car insurance', 'Electric', 'Internet']);
    expect(summaries[2].bills.map((b) => b.name)).toEqual(['Credit card', 'Rent']);
  });

  it('flags the paycheck with rent and a card payment as tight', () => {
    expect(summaries.map((s) => s.status)).toEqual(['covered', 'covered', 'tight']);
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
    const summaries = periods.map((p) => summarizePeriod(p, SAMPLE_BILLS, [planned]));
    expect(summaries.map((s) => s.extraTotal)).toEqual([0, 0, 800]);
    expect(summaries[2].leftForBuckets).toBe(2140 + 800 - 1190);
    expect(summaries[2].status).toBe('covered');
  });

  it('ignores expected money that has not been planned yet', () => {
    const summaries = periods.map((p) => summarizePeriod(p, SAMPLE_BILLS, [bonus]));
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
    const first = summarizePeriod(periods[0], SAMPLE_BILLS, events);
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
    // Nothing planned this paycheck: the bill is being paid from another one.
    expect(bucketDueStatus({ ...rent, planned: 0 }, p1, '2026-09-27')).toBeNull();
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
    const outlook = buildOutlook({ answers: { ...answers, paycheckAmount: 2000 }, bills: [], events: [], plans, deposit, extra: 1 });
    expect(outlook.map((s) => s.period.takeHome)).toEqual([2140, 2140, 2000, 2000]);
  });
});

describe('hourly pay plans', () => {
  const { buckets } = DEMO_DATA;
  const hourly = { ...DEMO_DATA.answers, payType: 'hourly' as const, hourlyRate: 22, typicalHours: 80, paycheckAmount: 1400 };

  it('starts a new plan from typical hours and their take-home', () => {
    const plan = planFor('2026-10-24', [], buckets, hourly);
    expect(plan.hours).toBe(80);
    expect(plan.takeHome).toBe(takeHomeForHours(hourly, 80));
    expect(plan.takeHome).toBeGreaterThan(0);
  });

  it('re-nets stored plans when the rate or taxes change', () => {
    const stored = [{ payday: '2026-10-10', takeHome: 999, hours: 60, allocations: {} }];
    const before = planFor('2026-10-10', stored, buckets, hourly).takeHome;
    expect(before).toBe(takeHomeForHours(hourly, 60));
    const raise = { ...hourly, hourlyRate: 30 };
    expect(planFor('2026-10-10', stored, buckets, raise).takeHome).toBeGreaterThan(before);
    expect(takeHomeFor('2026-10-10', raise, stored, null)).toBe(planFor('2026-10-10', stored, buckets, raise).takeHome);
    // A salaried plan keeps the amount typed into it.
    expect(planFor('2026-10-10', stored, buckets, DEMO_DATA.answers).takeHome).toBe(999);
  });

  it('falls back to the fixed amount for salaried pay', () => {
    expect(takeHomeForHours(DEMO_DATA.answers, 80)).toBe(2140);
    expect(planFor('2026-10-24', [], buckets, DEMO_DATA.answers).hours).toBeUndefined();
  });
});

describe('buckets that save up across paychecks', () => {
  const saver = { id: 'mortgage', name: 'Mortgage', planned: 900, defaultAmount: 900, spent: 0, kind: 'spending' as const, savesUp: true, carried: 900 };
  const plain = { id: 'groceries', name: 'Groceries', planned: 260, defaultAmount: 260, spent: 100, kind: 'spending' as const };

  it('counts what carried in as money the bucket can cover', () => {
    expect(bucketAvailable(saver)).toBe(1800);
    expect(bucketAvailable(plain)).toBe(260);
  });

  it('carries the leftover on, and nothing for a bucket that does not save', () => {
    expect(carryOver(saver)).toBe(1800);
    expect(carryOver({ ...saver, spent: 1800 })).toBe(0);
    expect(carryOver(plain)).toBe(0);
  });

  it('builds a balance over two paychecks and empties when the bill is paid', () => {
    // First paycheck: $900 in, nothing spent.
    let buckets = carryBalances([{ ...saver, carried: 0 }]);
    expect(buckets[0].carried).toBe(900);
    // Second paycheck: another $900 in.
    buckets = carryBalances(buckets.map((b) => ({ ...b, planned: 900, spent: 0 })));
    expect(buckets[0].carried).toBe(1800);
    // The mortgage goes out.
    buckets = carryBalances(buckets.map((b) => ({ ...b, planned: 0, spent: 1800 })));
    expect(buckets[0].carried).toBe(0);
  });

  it('leaves a bucket that does not save up untouched', () => {
    expect(carryBalances([plain])[0]).toEqual(plain);
  });

  it('treats a saving bucket that has never carried anything as holding nothing', () => {
    const fresh = { id: 'car', name: 'Car repairs', planned: 100, defaultAmount: 100, spent: 0, kind: 'spending' as const, savesUp: true };
    expect(bucketAvailable(fresh)).toBe(100);
    expect(carryBalances([fresh])[0].carried).toBe(100);
  });
});

describe('due dates on a bucket that saves up', () => {
  const period = { payday: '2026-09-26', end: '2026-10-09', takeHome: 2140 };
  // $475 from each of two paychecks toward a $950 mortgage due on the 1st.
  const mortgage = { id: 'mortgage', name: 'Mortgage', planned: 475, defaultAmount: 475, spent: 0, kind: 'spending' as const, dueDay: 1, savesUp: true, carried: 475 };

  it('is not paid until the whole balance has gone out', () => {
    // Half the bill spent: the reminder has to stay.
    expect(bucketDueStatus({ ...mortgage, spent: 475 }, period, '2026-09-30')?.paid).toBe(false);
    expect(bucketDueStatus({ ...mortgage, spent: 950 }, period, '2026-09-30')?.paid).toBe(true);
  });

  it('still reminds in the paycheck the money was saved for, even with nothing added', () => {
    // The last paycheck before the bill adds nothing; the balance already covers it.
    const status = bucketDueStatus({ ...mortgage, planned: 0, carried: 950 }, period, '2026-09-30');
    expect(status).not.toBeNull();
    expect(status?.paid).toBe(false);
  });

  it('ignores a balance on a bucket that does not save up', () => {
    expect(bucketDueStatus({ ...mortgage, savesUp: false, spent: 475 }, period, '2026-09-30')?.paid).toBe(true);
    expect(bucketDueStatus({ ...mortgage, savesUp: false, planned: 0 }, period, '2026-09-30')).toBeNull();
  });
});
