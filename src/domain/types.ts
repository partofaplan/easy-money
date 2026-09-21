export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'irregular';
export type BonusPattern = 'regular' | 'sometimes' | 'none';
export type PlanningHorizon = 'this' | 'few' | 'month';
export type BucketChoice = 'auto' | 'custom';
export type ThemeChoice = 'system' | 'light' | 'dark';

/** Everything the setup interview collects. Every field starts unanswered. */
export interface Answers {
  payFrequency: PayFrequency | null;
  /** ISO date, e.g. 2026-09-26 */
  nextPayday: string | null;
  bonuses: BonusPattern | null;
  horizon: PlanningHorizon | null;
  bucketChoice: BucketChoice | null;
  /** Typical after-tax paycheck, in dollars. */
  paycheckAmount: number | null;
}

export interface Bucket {
  id: string;
  name: string;
  /** Planned for the current paycheck, in dollars. */
  planned: number;
  /** Spent (or moved, for savings) in the current paycheck. */
  spent: number;
  kind: 'spending' | 'savings';
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
  /** ISO date */
  receivedOn: string;
  /** Where it went, once the user decides. */
  allocation: BonusAllocation | null;
}

export type BonusAllocation =
  | { kind: 'savings' }
  | { kind: 'debt' }
  | { kind: 'split' }
  | { kind: 'paycheck' };

/** Money set aside from one paycheck to help a later one. */
export interface Reserve {
  id: string;
  /** ISO payday of the paycheck the money comes from. */
  fromPayday: string;
  /** ISO payday of the paycheck it helps. */
  forPayday: string;
  amount: number;
}

export interface PayPeriod {
  /** ISO payday, which is also the first day of the period. */
  payday: string;
  /** ISO date of the last day in the period. */
  end: string;
  takeHome: number;
}

export interface AppData {
  version: 1;
  setupComplete: boolean;
  answers: Answers;
  buckets: Bucket[];
  bills: Bill[];
  incomeEvents: IncomeEvent[];
  reserves: Reserve[];
}

export const emptyAnswers: Answers = {
  payFrequency: null,
  nextPayday: null,
  bonuses: null,
  horizon: null,
  bucketChoice: null,
  paycheckAmount: null,
};
