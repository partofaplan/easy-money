/**
 * Static seed data for the proof of concept.
 *
 * Everything the app starts with lives here, so the design and flow can change
 * without touching a backend. Swap or extend these fixtures freely.
 */
import type { AppData, Bill, Bucket, IncomeEvent } from '../domain/types';

/** Starter buckets and the share of a paycheck each one gets by default. */
export const STARTER_BUCKETS: ReadonlyArray<{ id: string; name: string; share: number; kind: Bucket['kind'] }> = [
  { id: 'housing', name: 'Rent & housing', share: 0.44, kind: 'spending' },
  { id: 'groceries', name: 'Groceries', share: 0.12, kind: 'spending' },
  { id: 'bills', name: 'Bills & utilities', share: 0.1, kind: 'spending' },
  { id: 'transport', name: 'Getting around', share: 0.065, kind: 'spending' },
  { id: 'fun', name: 'Eating out & fun', share: 0.07, kind: 'spending' },
  { id: 'savings', name: 'Savings', share: 0.14, kind: 'savings' },
  { id: 'other', name: 'Everything else', share: 0.065, kind: 'spending' },
];

/** Sample bills used to populate the Ahead view. Rent is modelled as a bucket with a monthly target instead. */
export const SAMPLE_BILLS: Bill[] = [
  { id: 'phone-oct', name: 'Phone', amount: 65, dueDate: '2026-10-03' },
  { id: 'car-ins', name: 'Car insurance', amount: 180, dueDate: '2026-10-15' },
  { id: 'electric', name: 'Electric', amount: 110, dueDate: '2026-10-18' },
  { id: 'internet', name: 'Internet', amount: 70, dueDate: '2026-10-20' },
  { id: 'card', name: 'Credit card', amount: 240, dueDate: '2026-10-28' },
];

export const SAMPLE_BONUS: IncomeEvent = {
  id: 'bonus-acme',
  source: 'Acme Co',
  amount: 1200,
  date: '2026-09-30',
  status: 'received',
  allocation: null,
};

/** A bonus the user knows is coming, not yet planned into a paycheck. */
export const SAMPLE_EXPECTED_BONUS: IncomeEvent = {
  id: 'bonus-q3',
  source: 'Acme Co, quarterly bonus',
  amount: 800,
  date: '2026-10-15',
  status: 'expected',
  allocation: null,
};

/** The fully set-up budget shown to people who skip the walkthrough. */
export const DEMO_DATA: AppData = {
  version: 2,
  setupComplete: true,
  answers: {
    payFrequency: 'biweekly',
    nextPayday: '2026-09-26',
    bonuses: 'sometimes',
    horizon: 'few',
    bucketChoice: 'auto',
    paycheckAmount: 2140,
  },
  buckets: [
    // Rent is due on the 1st and saved for across two paychecks: $950 from each.
    { id: 'housing', name: 'Rent & housing', planned: 950, spent: 0, kind: 'spending', dueDay: 1, monthlyTarget: 1900, fundOver: 2, balance: 950 },
    { id: 'groceries', name: 'Groceries', planned: 260, spent: 84, kind: 'spending' },
    { id: 'bills', name: 'Bills & utilities', planned: 210, spent: 65, kind: 'spending', dueDay: 3 },
    { id: 'transport', name: 'Getting around', planned: 140, spent: 38, kind: 'spending' },
    { id: 'fun', name: 'Eating out & fun', planned: 150, spent: 41, kind: 'spending' },
    { id: 'savings', name: 'Savings', planned: 300, spent: 300, kind: 'savings' },
    { id: 'other', name: 'Everything else', planned: 130, spent: 12, kind: 'spending' },
  ],
  bills: SAMPLE_BILLS,
  incomeEvents: [SAMPLE_BONUS, SAMPLE_EXPECTED_BONUS],
  reserves: [],
};

/** Sample savings and debt balances shown on the extra-money screen. */
export const SAMPLE_BALANCES = {
  savings: 1450,
  creditCard: 1900,
};
