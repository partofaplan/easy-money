/**
 * Turns interview answers into a paycheck-based plan: pay periods, bucket
 * allocations, which bills land in which paycheck, and whether a paycheck
 * looks tight.
 */
import type { Answers, Bill, Bucket, Deposit, IncomeEvent, PaycheckPlan, PayFrequency, PayPeriod, PlanningHorizon } from './types';
import { STARTER_BUCKETS } from '../data/fixtures';
import { addDays, addMonths, parseISO, toISO } from '../lib/dates';
import { roundTo } from '../lib/money';
import { netForHours } from './takeHome';

/** Default twice-a-month pattern: the 1st and the 15th. */
export const DEFAULT_SEMIMONTHLY: [number, number] = [1, 15];

/** Presets offered for twice-a-month pay. 31 stands for the last day of the month. */
export const SEMIMONTHLY_PRESETS: { days: [number, number]; label: string }[] = [
  { days: [1, 15], label: 'The 1st and the 15th' },
  { days: [15, 31], label: 'The 15th and the last day' },
];

/** The date for a day-of-month in a given month, clamped so 31 means the last day. */
function dayInMonth(year: number, monthIndex: number, day: number): string {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  return toISO(new Date(year, monthIndex, Math.min(day, last)));
}

/** Paydays on a twice-a-month pattern, from the given date onward (inclusive), earliest first. */
export function semimonthlyPaydaysFrom(from: string, days: [number, number], count: number): string[] {
  const start = parseISO(from);
  const result: string[] = [];
  for (let m = 0; result.length < count && m < 12; m += 1) {
    const year = start.getFullYear();
    const month = start.getMonth() + m;
    const inMonth = [...days].sort((a, b) => a - b).map((d) => dayInMonth(year, month, d));
    for (const iso of inMonth) if (iso >= from && !result.includes(iso)) result.push(iso);
  }
  return result.slice(0, count);
}

/** The payday after `payday` for a given frequency. */
export function nextPayday(payday: string, frequency: PayFrequency, semimonthlyDays: [number, number] | null = null): string {
  switch (frequency) {
    case 'weekly':
      return addDays(payday, 7);
    case 'biweekly':
    case 'irregular':
      return addDays(payday, 14);
    case 'monthly':
      return addMonths(payday, 1);
    case 'semimonthly':
      return semimonthlyPaydaysFrom(addDays(payday, 1), semimonthlyDays ?? DEFAULT_SEMIMONTHLY, 1)[0];
  }
}

/** True when `iso` falls on one of the twice-a-month pay days (with 31 meaning the last day). */
export function isSemimonthlyPayday(iso: string, days: [number, number]): boolean {
  const d = parseISO(iso);
  return days.some((day) => dayInMonth(d.getFullYear(), d.getMonth(), day) === iso);
}

/** How many paychecks the Ahead view should show for a horizon. */
export function horizonCount(horizon: PlanningHorizon, frequency: PayFrequency, firstPayday: string, semimonthlyDays: [number, number] | null = null): number {
  if (horizon === 'this') return 1;
  if (horizon === 'few') return 3;
  // Whole month: every payday that falls in the same calendar month as the first.
  const month = parseISO(firstPayday).getMonth();
  let count = 1;
  let payday = nextPayday(firstPayday, frequency, semimonthlyDays);
  while (parseISO(payday).getMonth() === month && count < 6) {
    count += 1;
    payday = nextPayday(payday, frequency, semimonthlyDays);
  }
  return count;
}

/** Generate `count` consecutive pay periods starting at `firstPayday`. */
export function payPeriods(firstPayday: string, frequency: PayFrequency, takeHome: number, count: number, semimonthlyDays: [number, number] | null = null): PayPeriod[] {
  const periods: PayPeriod[] = [];
  let payday = firstPayday;
  for (let i = 0; i < count; i += 1) {
    const following = nextPayday(payday, frequency, semimonthlyDays);
    periods.push({ payday, end: addDays(following, -1), takeHome });
    payday = following;
  }
  return periods;
}

/** The payday after the current one, honouring the twice-a-month pattern. */
export function followingPayday(answers: Answers, payday: string): string | null {
  return answers.payFrequency ? nextPayday(payday, answers.payFrequency, answers.semimonthlyDays) : null;
}

/** Split a paycheck across the starter buckets, rounded to $10, remainder to "Everything else". */
export function suggestBuckets(paycheck: number): Bucket[] {
  const buckets: Bucket[] = STARTER_BUCKETS.map((t) => ({
    id: t.id,
    name: t.name,
    planned: roundTo(paycheck * t.share, 10),
    defaultAmount: 0,
    spent: 0,
    kind: t.kind,
  }));
  const assigned = buckets.reduce((sum, b) => sum + b.planned, 0);
  const other = buckets.find((b) => b.id === 'other') ?? buckets[buckets.length - 1];
  other.planned = Math.max(0, other.planned + Math.round(paycheck - assigned));
  return buckets.map((b) => ({ ...b, defaultAmount: b.planned }));
}

/** Re-spread a paycheck over an existing bucket list, keeping their relative sizes. */
export function rescaleBuckets(buckets: Bucket[], paycheck: number): Bucket[] {
  const total = buckets.reduce((s, b) => s + b.planned, 0);
  if (total <= 0) return suggestBuckets(paycheck).filter((s) => buckets.some((b) => b.id === s.id));
  const scaled = buckets.map((b) => ({ ...b, planned: roundTo((b.planned / total) * paycheck, 10) }));
  const assigned = scaled.reduce((s, b) => s + b.planned, 0);
  const last = scaled[scaled.length - 1];
  last.planned = Math.max(0, last.planned + Math.round(paycheck - assigned));
  return scaled.map((b) => ({ ...b, defaultAmount: b.planned }));
}

/** Everything a bucket can cover this paycheck: what carried in, plus this paycheck's fill. */
export function bucketAvailable(bucket: Bucket): number {
  return (bucket.carried ?? 0) + bucket.planned;
}

/** What a bucket carries into the next paycheck. Zero unless it saves up. */
export function carryOver(bucket: Bucket): number {
  return bucket.savesUp ? bucketAvailable(bucket) - bucket.spent : 0;
}

/**
 * Move each saves-up bucket's leftover into its carried balance. Run when a new
 * paycheck starts, before the buckets are refilled and spending is reset.
 */
export function carryBalances(buckets: Bucket[]): Bucket[] {
  return buckets.map((b) => (b.savesUp ? { ...b, carried: carryOver(b) } : b));
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

export function summarizePeriod(period: PayPeriod, bills: Bill[], events: IncomeEvent[]): PeriodSummary {
  const inPeriod = billsInPeriod(bills, period);
  const billsTotal = inPeriod.reduce((s, b) => s + b.amount, 0);
  const extraIncome = extraForPayday(events, period.payday);
  const extraTotal = extraIncome.reduce((s, e) => s + e.amount, 0);
  const leftForBuckets = period.takeHome + extraTotal - billsTotal;
  return {
    period,
    bills: inPeriod,
    billsTotal,
    extraIncome,
    extraTotal,
    leftForBuckets,
    status: leftForBuckets < period.takeHome * TIGHT_SHARE ? 'tight' : 'covered',
  };
}

/** The pay period (from `periods`) that a date falls in, or null if it is outside them. */
export function periodForDate(periods: PayPeriod[], date: string): PayPeriod | null {
  return periods.find((p) => date >= p.payday && date <= p.end) ?? null;
}

/** Everything the Ahead view needs, derived from answers and data. */
export interface OutlookInput {
  answers: Answers;
  bills: Bill[];
  events: IncomeEvent[];
  plans: PaycheckPlan[];
  deposit: Deposit | null;
  /** Paychecks to include beyond the horizon from setup. */
  extra?: number;
}

/** Take-home for a payday: what actually landed, else what the plan expects, else the setup default. */
export function takeHomeFor(payday: string, answers: Answers, plans: PaycheckPlan[], deposit: Deposit | null): number {
  if (deposit?.payday === payday) return deposit.amount;
  const stored = plans.find((p) => p.payday === payday);
  return stored ? planTakeHome(stored, answers) : defaultTakeHome(answers);
}

export function buildOutlook({ answers, bills, events, plans, deposit, extra = 0 }: OutlookInput): PeriodSummary[] {
  if (!answers.payFrequency || !answers.nextPayday) return [];
  const count = horizonCount(answers.horizon ?? 'few', answers.payFrequency, answers.nextPayday, answers.semimonthlyDays) + extra;
  return payPeriods(answers.nextPayday, answers.payFrequency, 0, count, answers.semimonthlyDays)
    .map((p) => ({ ...p, takeHome: takeHomeFor(p.payday, answers, plans, deposit) }))
    .map((p) => summarizePeriod(p, bills, events));
}

export function isHourly(answers: Answers): boolean {
  return answers.payType === 'hourly' && (answers.hourlyRate ?? 0) > 0;
}

/** Take-home for a number of hours under this user's rate, frequency and taxes. */
export function takeHomeForHours(answers: Answers, hours: number): number {
  if (!isHourly(answers) || !answers.payFrequency) return answers.paycheckAmount ?? 0;
  return netForHours(answers.hourlyRate ?? 0, hours, answers.payFrequency, answers.tax);
}

/**
 * The take-home a paycheck starts from when nothing else is known: the typical
 * hours netted out for hourly pay, else the amount given at setup. The one
 * place this is decided.
 */
export function defaultTakeHome(answers: Answers): number {
  return isHourly(answers) ? takeHomeForHours(answers, answers.typicalHours ?? 0) : (answers.paycheckAmount ?? 0);
}

/**
 * What a plan expects to land. Hourly plans are netted from their hours at read
 * time, so a later change to the rate or tax details flows into every plan.
 */
export function planTakeHome(plan: PaycheckPlan, answers: Answers): number {
  if (!isHourly(answers)) return plan.takeHome;
  return takeHomeForHours(answers, plan.hours ?? answers.typicalHours ?? 0);
}

/** The plan for a payday: the stored one, or a fresh one from each bucket's default amount. */
export function planFor(payday: string, plans: PaycheckPlan[], buckets: Bucket[], answers: Answers): PaycheckPlan {
  const stored = plans.find((p) => p.payday === payday);
  if (stored) return { ...stored, takeHome: planTakeHome(stored, answers) };
  const hourly = isHourly(answers);
  const hours = hourly ? (answers.typicalHours ?? 0) : undefined;
  return {
    payday,
    takeHome: defaultTakeHome(answers),
    hours,
    allocations: Object.fromEntries(buckets.map((b) => [b.id, b.defaultAmount])),
  };
}

/** A plan's amount for a bucket. A bucket added after the plan was stored uses its default. */
export function plannedAmount(plan: PaycheckPlan, bucket: Bucket): number {
  return plan.allocations[bucket.id] ?? bucket.defaultAmount;
}

export function planAssigned(plan: PaycheckPlan, buckets: Bucket[]): number {
  return buckets.reduce((s, b) => s + plannedAmount(plan, b), 0);
}

/** Buckets with their amounts filled from a plan. */
export function fillFromPlan(buckets: Bucket[], plan: PaycheckPlan): Bucket[] {
  return buckets.map((b) => ({ ...b, planned: plannedAmount(plan, b) }));
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
  // Nothing planned for this paycheck means the bill is being paid from another one: no reminder.
  if (!dueOn || bucket.planned <= 0) return null;
  const paid = bucket.paidOn === dueOn || bucket.spent >= bucket.planned;
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
