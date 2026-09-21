import { describe, expect, it } from 'vitest';
import { extraForCurrentPaycheck, horizonCount, nextPayday, payPeriods, periodForDate, suggestBuckets, suggestSmoothing, summarizePeriod } from './plan';
import { SAMPLE_BILLS } from '../data/fixtures';

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
  const summaries = periods.map((p) => summarizePeriod(p, SAMPLE_BILLS, []));

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
    const after = periods.map((p) => summarizePeriod(p, SAMPLE_BILLS, reserves));
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
    expect(extraForCurrentPaycheck([bonus], '2026-09-26')).toBe(0);
  });

  it('counts money moved to buckets and money folded into this paycheck, not debt', () => {
    const events = [
      { ...bonus, id: 's', status: 'received' as const, allocation: { kind: 'savings' as const } },
      { ...bonus, id: 'd', status: 'received' as const, allocation: { kind: 'debt' as const } },
      { ...bonus, id: 'p', allocation: { kind: 'paycheck' as const, payday: '2026-09-26' } },
      { ...bonus, id: 'later', allocation: { kind: 'paycheck' as const, payday: '2026-10-10' } },
    ];
    expect(extraForCurrentPaycheck(events, '2026-09-26')).toBe(1600);
  });
});
