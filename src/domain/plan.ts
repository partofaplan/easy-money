/**
 * Turns interview answers into a paycheck-based plan: pay periods, bucket
 * allocations, which bills land in which paycheck, and whether a paycheck
 * looks tight.
 */
import type { Answers, Bill, Bucket, IncomeEvent, PayFrequency, PayPeriod, PlanningHorizon, Reserve } from './types';
import { STARTER_BUCKETS } from '../data/fixtures';
import { PAYCHECKS_PER_YEAR } from '../data/taxTables';
import { addDays, addMonths, parseISO, toISO } from '../lib/dates';
import { roundTo } from '../lib/money';

/** The payday after `payday` for a given frequency. */
export function nextPayday(payday: string, frequency: PayFrequency): string {
  switch (frequency) {
    case 'weekly':
      return addDays(payday, 7);
    case 'biweekly':
    case 'irregular':
      return addDays(payday, 14);
    case 'monthly':
      return addMonths(payday, 1);
    case 'semimonthly': {
      // Paid twice a month: if this payday is in the first half, the next one
      // is 15 days later; otherwise it is the same day-of-month next month.
      const d = parseISO(payday);
      if (d.getDate() <= 15) return addDays(payday, 15);
      const first = new Date(d.getFullYear(), d.getMonth() + 1, Math.max(1, d.getDate() - 15));
      return toISO(first);
    }
  }
}

/** How many paychecks the Ahead view should show for a horizon. */
export function horizonCount(horizon: PlanningHorizon, frequency: PayFrequency, firstPayday: string): number {
  if (horizon === 'this') return 1;
  if (horizon === 'few') return 3;
  // Whole month: every payday that falls in the same calendar month as the first.
  const month = parseISO(firstPayday).getMonth();
  let count = 1;
  let payday = nextPayday(firstPayday, frequency);
  while (parseISO(payday).getMonth() === month && count < 6) {
    count += 1;
    payday = nextPayday(payday, frequency);
  }
  return count;
}

/** Generate `count` consecutive pay periods starting at `firstPayday`. */
export function payPeriods(firstPayday: string, frequency: PayFrequency, takeHome: number, count: number): PayPeriod[] {
  const periods: PayPeriod[] = [];
  let payday = firstPayday;
  for (let i = 0; i < count; i += 1) {
    const following = nextPayday(payday, frequency);
    periods.push({ payday, end: addDays(following, -1), takeHome });
    payday = following;
  }
  return periods;
}

/** Split a paycheck across the starter buckets, rounded to $10, remainder to "Everything else". */
export function suggestBuckets(paycheck: number): Bucket[] {
  const buckets: Bucket[] = STARTER_BUCKETS.map((t) => ({
    id: t.id,
    name: t.name,
    planned: roundTo(paycheck * t.share, 10),
    spent: 0,
    kind: t.kind,
  }));
  const assigned = buckets.reduce((sum, b) => sum + b.planned, 0);
  const other = buckets.find((b) => b.id === 'other') ?? buckets[buckets.length - 1];
  other.planned = Math.max(0, other.planned + Math.round(paycheck - assigned));
  return buckets;
}

/** Re-spread a paycheck over an existing bucket list, keeping their relative sizes. */
export function rescaleBuckets(buckets: Bucket[], paycheck: number): Bucket[] {
  const total = buckets.reduce((s, b) => s + b.planned, 0);
  if (total <= 0) return suggestBuckets(paycheck).filter((s) => buckets.some((b) => b.id === s.id));
  const scaled = buckets.map((b) => ({ ...b, planned: roundTo((b.planned / total) * paycheck, 10) }));
  const assigned = scaled.reduce((s, b) => s + b.planned, 0);
  const last = scaled[scaled.length - 1];
  last.planned = Math.max(0, last.planned + Math.round(paycheck - assigned));
  return scaled;
}

export function billsInPeriod(bills: Bill[], period: PayPeriod): Bill[] {
  return bills
    .filter((b) => b.dueDate >= period.payday && b.dueDate <= period.end)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export interface PeriodSummary {
  period: PayPeriod;
  bills: Bill[];
  billsTotal: number;
  /** Bonuses and other extra money planned into this paycheck. */
  extraIncome: IncomeEvent[];
  extraTotal: number;
  /** Set aside for later paychecks (negative) or brought in from earlier ones (positive). */
  reserveNet: number;
  leftForBuckets: number;
  status: 'covered' | 'tight';
}

/** A paycheck is "tight" when less than this share of it is left after bills. */
export const TIGHT_SHARE = 0.5;

/**
 * Extra money counted in the paycheck with this payday: anything planned into
 * it, moved to savings, or split. Debt payments leave the budget, so they are
 * excluded. This is the single definition Home, Ahead and Buckets all use.
 */
export function extraForPayday(events: IncomeEvent[], payday: string | null): IncomeEvent[] {
  if (!payday) return [];
  return events.filter((e) => e.allocation !== null && e.allocation.kind !== 'debt' && e.allocation.payday === payday);
}

export function extraTotalForPayday(events: IncomeEvent[], payday: string | null): number {
  return extraForPayday(events, payday).reduce((s, e) => s + e.amount, 0);
}

export function summarizePeriod(period: PayPeriod, bills: Bill[], reserves: Reserve[], events: IncomeEvent[]): PeriodSummary {
  const inPeriod = billsInPeriod(bills, period);
  const billsTotal = inPeriod.reduce((s, b) => s + b.amount, 0);
  const out = reserves.filter((r) => r.fromPayday === period.payday).reduce((s, r) => s + r.amount, 0);
  const inn = reserves.filter((r) => r.forPayday === period.payday).reduce((s, r) => s + r.amount, 0);
  const reserveNet = inn - out;
  const extraIncome = extraForPayday(events, period.payday);
  const extraTotal = extraIncome.reduce((s, e) => s + e.amount, 0);
  const leftForBuckets = period.takeHome + extraTotal - billsTotal + reserveNet;
  return {
    period,
    bills: inPeriod,
    billsTotal,
    extraIncome,
    extraTotal,
    reserveNet,
    leftForBuckets,
    status: leftForBuckets < period.takeHome * TIGHT_SHARE ? 'tight' : 'covered',
  };
}

/** The pay period (from `periods`) that a date falls in, or null if it is outside them. */
export function periodForDate(periods: PayPeriod[], date: string): PayPeriod | null {
  return periods.find((p) => date >= p.payday && date <= p.end) ?? null;
}

export interface Smoothing {
  /** The tight paycheck this helps. */
  forPayday: string;
  /** Paychecks to set money aside from. */
  fromPaydays: string[];
  /** Amount to set aside from each. */
  perPaycheck: number;
}

/**
 * If a later paycheck is tight and earlier ones are covered, suggest setting a
 * round amount aside from each earlier paycheck so the tight one clears the bar.
 */
export function suggestSmoothing(summaries: PeriodSummary[]): Smoothing | null {
  const tightIndex = summaries.findIndex((s) => s.status === 'tight');
  if (tightIndex <= 0) return null;
  const tight = summaries[tightIndex];
  const shortfall = tight.period.takeHome * TIGHT_SHARE - tight.leftForBuckets;
  if (shortfall <= 0) return null;

  // Start with every covered paycheck before the tight one, then drop any that
  // would itself become tight, re-splitting the amount among the rest.
  let donors = summaries.slice(0, tightIndex).filter((s) => s.status === 'covered');
  while (donors.length > 0) {
    const perPaycheck = Math.ceil(shortfall / donors.length / 10) * 10;
    const able = donors.filter((d) => d.leftForBuckets - perPaycheck >= d.period.takeHome * TIGHT_SHARE);
    if (able.length === donors.length) {
      return { forPayday: tight.period.payday, fromPaydays: donors.map((d) => d.period.payday), perPaycheck };
    }
    donors = able;
  }
  return null;
}

/** Everything the Ahead view needs, derived from answers and data. */
export function buildOutlook(answers: Answers, bills: Bill[], reserves: Reserve[], events: IncomeEvent[]): PeriodSummary[] {
  if (!answers.payFrequency || !answers.nextPayday) return [];
  const takeHome = answers.paycheckAmount ?? 0;
  const count = horizonCount(answers.horizon ?? 'few', answers.payFrequency, answers.nextPayday);
  return payPeriods(answers.nextPayday, answers.payFrequency, takeHome, count).map((p) => summarizePeriod(p, bills, reserves, events));
}

export const FREQUENCY_LABEL: Record<PayFrequency, string> = {
  weekly: 'every week',
  biweekly: 'every two weeks',
  semimonthly: 'twice a month',
  monthly: 'once a month',
  irregular: 'on a changing schedule',
};

/** The date in `period` on which a bucket with `dueDay` is due, or null if none falls inside it. */
export function dueDateInPeriod(dueDay: number | null | undefined, period: PayPeriod): string | null {
  if (!dueDay) return null;
  const start = parseISO(period.payday);
  const end = parseISO(period.end);
  // Walk each month the period touches and see whether its due date lands inside.
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const candidate = toISO(new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(dueDay, lastDay)));
    if (candidate >= period.payday && candidate <= period.end) return candidate;
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return null;
}

export interface DueStatus {
  /** ISO date the payment is due within the paycheck. */
  dueOn: string;
  /** True once spending reaches the planned amount, or the user marked this due date paid. */
  paid: boolean;
  /** True when the due date has passed and it is not paid. */
  overdue: boolean;
}

/** Whether a bucket is due within a paycheck, and where it stands. */
export function bucketDueStatus(bucket: Bucket, period: PayPeriod, todayISO: string): DueStatus | null {
  const dueOn = dueDateInPeriod(bucket.dueDay, period);
  if (!dueOn) return null;
  const need = bucket.monthlyTarget ?? bucket.planned;
  const paid = bucket.paidOn === dueOn || (need > 0 && bucket.spent >= need);
  return { dueOn, paid, overdue: !paid && todayISO > dueOn };
}

/** Buckets whose due day falls in a paycheck, with the date. Valid for any paycheck. */
export function dueDatesInPeriod(buckets: Bucket[], period: PayPeriod): { bucket: Bucket; dueOn: string }[] {
  return buckets
    .flatMap((bucket) => {
      const dueOn = dueDateInPeriod(bucket.dueDay, period);
      return dueOn ? [{ bucket, dueOn }] : [];
    })
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

/**
 * Buckets due in the CURRENT paycheck, with status. `spent` is tracked per
 * paycheck, so paid/overdue only mean something for the paycheck in progress.
 */
export function bucketsDueInPeriod(buckets: Bucket[], period: PayPeriod, todayISO: string): { bucket: Bucket; due: DueStatus }[] {
  return buckets
    .flatMap((bucket) => {
      const due = bucketDueStatus(bucket, period, todayISO);
      return due ? [{ bucket, due }] : [];
    })
    .sort((a, b) => a.due.dueOn.localeCompare(b.due.dueOn));
}

/** Paychecks in a typical month for a pay frequency: how many a monthly bill can be split across. */
export function paychecksPerMonth(frequency: PayFrequency): number {
  return Math.max(1, Math.round(PAYCHECKS_PER_YEAR[frequency] / 12));
}

/** Even per-paycheck set-aside for a monthly amount spread across `over` paychecks. */
export function suggestedSetAside(monthlyTarget: number, over: number): number {
  return Math.ceil(monthlyTarget / Math.max(1, over));
}

/** One paycheck's step in saving toward a bucket's monthly target. */
export interface FundingStep {
  payday: string;
  /** Set aside from this paycheck. */
  setAside: number;
  /** In the envelope after this paycheck's set-aside, before any payment. */
  ready: number;
  /** ISO date the bill is due within this paycheck, if any. */
  dueOn: string | null;
  /** Amount still missing on the due date; 0 when the envelope covers it. */
  short: number;
  /** Left in the envelope after paying the bill (or carried forward if none is due). */
  carried: number;
}

/**
 * Project how a bucket with a monthly target fills up and pays out across the
 * given paychecks. Set-aside happens on payday, before any due date in that
 * paycheck. `spentSoFar` is what the current paycheck has already paid.
 */
export function projectFunding(bucket: Bucket, periods: PayPeriod[]): FundingStep[] {
  const target = bucket.monthlyTarget ?? 0;
  let carried = bucket.balance ?? 0;
  return periods.map((period, i) => {
    const setAside = bucket.planned;
    const ready = carried + setAside;
    const dueOn = dueDateInPeriod(bucket.dueDay, period);
    const alreadyPaid = i === 0 && dueOn !== null && (bucket.paidOn === dueOn || bucket.spent >= target);
    const short = dueOn && !alreadyPaid ? Math.max(0, target - ready) : 0;
    carried = dueOn ? Math.max(0, ready - target) : ready;
    return { payday: period.payday, setAside, ready, dueOn, short, carried };
  });
}

/** True for buckets saved for across paychecks toward a monthly bill. */
export function hasMonthlyTarget(bucket: Bucket): bucket is Bucket & { monthlyTarget: number } {
  return typeof bucket.monthlyTarget === 'number' && bucket.monthlyTarget > 0;
}
