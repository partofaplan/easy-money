import { describe, expect, it } from 'vitest';
import { DEMO_DATA } from '../data/fixtures';
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

describe('reducer: next paycheck', () => {
  it('advances the payday, carries envelope balances and resets spending', () => {
    const before = demo();
    const state = reducer(before, { type: 'startNextPaycheck' });
    expect(state.answers.nextPayday).toBe('2026-10-10');
    const rent = state.buckets.find((b) => b.id === 'housing')!;
    expect(rent.balance).toBe(950 + 950);
    expect(rent.spent).toBe(0);
    const groceries = state.buckets.find((b) => b.id === 'groceries')!;
    expect(groceries.spent).toBe(0);
    expect(groceries.balance).toBeUndefined();
  });

  it('pays the envelope out before carrying the rest', () => {
    const paid = reducer(demo(), { type: 'addPurchase', bucketId: 'housing', amount: 1900 });
    const state = reducer(paid, { type: 'startNextPaycheck' });
    expect(state.buckets.find((b) => b.id === 'housing')?.balance).toBe(0);
  });
});
