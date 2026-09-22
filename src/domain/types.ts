export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'irregular';
export type BonusPattern = 'regular' | 'sometimes' | 'none';
export type PlanningHorizon = 'this' | 'few' | 'month';
export type BucketChoice = 'auto' | 'custom';
export type ThemeChoice = 'system' | 'light' | 'dark';

export type PayType = 'salary' | 'hourly';

/** What the take-home estimator needs besides gross pay. Saved so hourly pay can be netted out any time. */
export interface TaxSettings {
  /** Two-letter state code, or empty when unknown (no state tax applied). */
  stateCode: string;
  filing: 'single' | 'married' | 'head';
  /** Percent of gross to retirement, e.g. 4 for 4%. */
  retirementPct: number;
  /** Health premium per paycheck, pre-tax. */
  healthPerPaycheck: number;
}

/** Everything the setup interview collects. Every field starts unanswered. */
export interface Answers {
  payFrequency: PayFrequency | null;
  /**
   * For twice-a-month pay, the two days of the month paid on (31 means the last
   * day). Null means the 1st and the 15th.
   */
  semimonthlyDays: [number, number] | null;
  /** ISO date, e.g. 2026-09-26 */
  nextPayday: string | null;
  bonuses: BonusPattern | null;
  horizon: PlanningHorizon | null;
  bucketChoice: BucketChoice | null;
  /** Typical after-tax paycheck, in dollars. For hourly pay, the take-home for typical hours. */
  paycheckAmount: number | null;
  /** Salary (a steady amount) or hourly (hours decide each paycheck). */
  payType: PayType;
  /** Gross pay per hour, for hourly pay. */
  hourlyRate: number | null;
  /** Hours usually worked in one paycheck, for hourly pay. */
  typicalHours: number | null;
  /** Saved from the estimator; null until the user has been through it. */
  tax: TaxSettings | null;
}

export interface Bucket {
  id: string;
  name: string;
  /** Filled into this bucket for the current paycheck, in dollars. */
  planned: number;
  /** The amount a new paycheck plan starts from. Edited on the Buckets screen. */
  defaultAmount: number;
  /** Spent (or moved, for savings) in the current paycheck. */
  spent: number;
  kind: 'spending' | 'savings';
  /**
   * Day of the month this bucket's payment is due, 1 to 31. Days past the end
   * of a month clamp to its last day, so 31 means "the last day". Optional so
   * older stored data keeps working; absent means no due date.
   */
  dueDay?: number;
  /** ISO due date the user marked as paid by hand, when spending alone would not show it. */
  paidOn?: string;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  /** ISO date */
  dueDate: string;
}

export interface IncomeEvent {
  id: string;
  source: string;
  amount: number;
  /** ISO date it arrived, or is expected to arrive. */
  date: string;
  /** Expected money is planned ahead; received money is decided on when it lands. */
  status: 'expected' | 'received';
  /** Where it goes, once the user decides. */
  allocation: BonusAllocation | null;
}

export type AllocationKind = 'savings' | 'debt' | 'split' | 'paycheck';

export interface BonusAllocation {
  kind: AllocationKind;
  /**
   * The paycheck this money is counted in, by payday. Expected money is planned
   * into a future paycheck; received money goes into the paycheck that was
   * current when the decision was made. Debt payments are recorded here too
   * but never counted as available money.
   */
  payday: string;
}

export interface PaycheckPlan {
  /** ISO payday this plan is for. */
  payday: string;
  /** Take-home expected on that payday. For hourly pay, derived from `hours`. */
  takeHome: number;
  /** Hours expected in this paycheck, for hourly pay. */
  hours?: number;
  /** Amount to fill into each bucket, by bucket id. Buckets not listed get 0. */
  allocations: Record<string, number>;
}

/** The paycheck the user confirmed has landed, and what actually arrived. */
export interface Deposit {
  payday: string;
  amount: number;
  /** Hours worked, when pay is hourly. */
  hours?: number;
}

export interface PayPeriod {
  /** ISO payday, which is also the first day of the period. */
  payday: string;
  /** ISO date of the last day in the period. */
  end: string;
  takeHome: number;
}

export interface AppData {
  version: 5;
  setupComplete: boolean;
  answers: Answers;
  buckets: Bucket[];
  bills: Bill[];
  incomeEvents: IncomeEvent[];
  /** Plans for upcoming paychecks, only stored once the user edits one. */
  plans: PaycheckPlan[];
  /** The current paycheck's confirmed deposit, or null until the user confirms it. */
  deposit: Deposit | null;
  /** Paychecks to plan beyond the horizon from setup, added with "Plan another paycheck". */
  extraPlanned: number;
}

export const emptyAnswers: Answers = {
  payFrequency: null,
  semimonthlyDays: null,
  nextPayday: null,
  bonuses: null,
  horizon: null,
  bucketChoice: null,
  paycheckAmount: null,
  payType: 'salary',
  hourlyRate: null,
  typicalHours: null,
  tax: null,
};
