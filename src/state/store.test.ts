import { describe, expect, it } from 'vitest';
import { DEMO_DATA } from '../data/fixtures';
import type { AppData } from '../domain/types';
import { bucketsFromLifestyle } from '../domain/lifestyle';
import { reducer } from './store';

const demo = () => structuredClone(DEMO_DATA);

describe('reducer: extra money', () => {
  it('moves a received bonus into savings and records the paycheck', () => {
    const state = reducer(demo(), { type: 'allocateIncome', eventId: 'bonus-acme', allocation: { kind: 'savings', payday: '2026-09-26' } });
    const savings = state.buckets.find((b) => b.kind === 'savings')!;
    expect(savings.planned).toBe(300 + 1200);
    expect(savings.spent).toBe(300 + 1200);
    expect(state.incomeEvents.find((e) => e.id === 'bonus-acme')?.allocation).toEqual({ kind: 'savings', payday: '2026-09-26' });
  });

  it('sends a bonus to the emergency fund when the interview made several savings envelopes', () => {
    const buckets = bucketsFromLifestyle({ home: ['rent'], goals: ['travel', 'goal', 'emergency'] });
    expect(buckets.filter((b) => b.kind === 'savings').length).toBeGreaterThan(1);
    const state = reducer({ ...demo(), buckets }, { type: 'allocateIncome', eventId: 'bonus-acme', allocation: { kind: 'savings', payday: '2026-09-26' } });
    const funded = state.buckets.filter((b) => b.planned !== buckets.find((x) => x.id === b.id)?.planned);
    expect(funded.map((b) => b.name)).toEqual(['Emergency fund']);
  });

  it('only lets expected money be planned into a paycheck', () => {
    const ignored = reducer(demo(), { type: 'allocateIncome', eventId: 'bonus-q3', allocation: { kind: 'savings', payday: '2026-10-10' } });
    expect(ignored.incomeEvents.find((e) => e.id === 'bonus-q3')?.allocation).toBeNull();
    const planned = reducer(demo(), { type: 'allocateIncome', eventId: 'bonus-q3', allocation: { kind: 'paycheck', payday: '2026-10-10' } });
    expect(planned.incomeEvents.find((e) => e.id === 'bonus-q3')?.allocation).toEqual({ kind: 'paycheck', payday: '2026-10-10' });
    expect(planned.buckets).toEqual(demo().buckets);
  });

  it('marks expected money received without losing its plan', () => {
    const planned = reducer(demo(), { type: 'allocateIncome', eventId: 'bonus-q3', allocation: { kind: 'paycheck', payday: '2026-10-10' } });
    const landed = reducer(planned, { type: 'markReceived', eventId: 'bonus-q3' });
    const e = landed.incomeEvents.find((x) => x.id === 'bonus-q3')!;
    expect(e.status).toBe('received');
    expect(e.allocation).toEqual({ kind: 'paycheck', payday: '2026-10-10' });
  });
});

describe('reducer: paycheck plans and confirmation', () => {
  it('stores a plan per payday, replacing an earlier one', () => {
    const plan = { payday: '2026-10-24', takeHome: 2200, allocations: { housing: 1900 } };
    let state = reducer(demo(), { type: 'setPlan', plan });
    state = reducer(state, { type: 'setPlan', plan: { ...plan, takeHome: 2300 } });
    expect(state.plans.filter((p) => p.payday === '2026-10-24')).toHaveLength(1);
    expect(state.plans.map((p) => p.payday)).toEqual(['2026-10-10', '2026-10-24']);
  });

  it('confirms the current paycheck: records the deposit and fills buckets', () => {
    const start = { ...demo(), deposit: null };
    const state = reducer(start, { type: 'confirmPaycheck', payday: '2026-09-26', amount: 2200 });
    expect(state.deposit).toEqual({ payday: '2026-09-26', amount: 2200 });
    expect(state.answers.nextPayday).toBe('2026-09-26');
    expect(state.buckets.find((b) => b.id === 'housing')).toMatchObject({ planned: 950, spent: 950 });
  });

  it('confirms the next paycheck: advances, fills from its plan, resets spending', () => {
    const marked = reducer(demo(), { type: 'markBucketPaid', bucketId: 'housing', dueOn: '2026-10-01' });
    const state = reducer(marked, { type: 'confirmPaycheck', payday: '2026-10-10', amount: 2140 });
    expect(state.answers.nextPayday).toBe('2026-10-10');
    expect(state.deposit).toEqual({ payday: '2026-10-10', amount: 2140 });
    const bills = state.buckets.find((b) => b.id === 'bills')!;
    expect(bills).toMatchObject({ planned: 360, spent: 0 });
    expect(state.buckets.find((b) => b.id === 'housing')?.paidOn).toBeUndefined();
    // Once confirmed, the buckets are the truth and the stored plan goes.
    expect(state.plans).toEqual([]);
  });

  it('accepts any later date as the next paycheck when pay is irregular', () => {
    const irregular = { ...demo(), answers: { ...demo().answers, payFrequency: 'irregular' as const } };
    const state = reducer(irregular, { type: 'confirmPaycheck', payday: '2026-10-03', amount: 1800 });
    expect(state.answers.nextPayday).toBe('2026-10-03');
    expect(state.deposit?.amount).toBe(1800);
  });

  it('ignores a confirmation for a paycheck that is neither current nor next', () => {
    const state = reducer(demo(), { type: 'confirmPaycheck', payday: '2026-10-24', amount: 2140 });
    expect(state).toEqual(demo());
  });
});

describe('reducer: buckets that save up', () => {
  /** The mortgage case: half from each paycheck, paid in full after the second. */
  const withMortgage = (): AppData => {
    const base = demo();
    return {
      ...base,
      plans: [],
      deposit: null,
      buckets: [
        { id: 'mortgage', name: 'Mortgage', planned: 900, defaultAmount: 900, spent: 0, kind: 'spending' as const, savesUp: true, carried: 0 },
        ...base.buckets.filter((b) => b.id !== 'housing'),
      ],
    };
  };

  it('carries what is left into the next paycheck and empties when the bill is paid', () => {
    let state = withMortgage();
    const mortgage = (s: AppData) => s.buckets.find((b) => b.id === 'mortgage')!;

    // Second paycheck lands: the first $900 carries over and another $900 is filled in.
    state = reducer(state, { type: 'confirmPaycheck', payday: '2026-10-10', amount: 2140 });
    expect(mortgage(state).carried).toBe(900);
    expect(mortgage(state).planned).toBe(900);
    expect(mortgage(state).spent).toBe(0);

    // Paying the mortgage spends everything the bucket holds.
    state = reducer(state, { type: 'addPurchase', bucketId: 'mortgage', amount: 1800 });
    state = reducer(state, { type: 'confirmPaycheck', payday: '2026-10-24', amount: 2140 });
    expect(mortgage(state).carried).toBe(0);
  });

  it('still resets an ordinary bucket each paycheck', () => {
    let state = reducer(withMortgage(), { type: 'addPurchase', bucketId: 'groceries', amount: 200 });
    state = reducer(state, { type: 'confirmPaycheck', payday: '2026-10-10', amount: 2140 });
    const groceries = state.buckets.find((b) => b.id === 'groceries')!;
    expect(groceries.spent).toBe(0);
    expect(groceries.carried).toBeUndefined();
  });
});
