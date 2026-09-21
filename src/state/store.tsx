import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { Answers, AppData, BonusAllocation, Bucket, IncomeEvent, Reserve } from '../domain/types';
import { emptyAnswers } from '../domain/types';
import { rescaleBuckets, suggestBuckets } from '../domain/plan';
import { DEMO_DATA, SAMPLE_BILLS, STARTER_BUCKETS } from '../data/fixtures';
import { newId } from '../lib/money';
import { LocalStorageRepository, type Repository } from './repository';

export const initialData: AppData = {
  version: 2,
  setupComplete: false,
  answers: emptyAnswers,
  buckets: [],
  bills: [],
  incomeEvents: [],
  reserves: [],
};

export type Action =
  | { type: 'answer'; patch: Partial<Answers> }
  | { type: 'setBuckets'; buckets: Bucket[] }
  | { type: 'completeSetup' }
  | { type: 'loadDemo' }
  | { type: 'addPurchase'; bucketId: string; amount: number }
  | { type: 'markBucketPaid'; bucketId: string; dueOn: string | undefined }
  | { type: 'addIncome'; event: Omit<IncomeEvent, 'id' | 'allocation'> }
  | { type: 'allocateIncome'; eventId: string; allocation: BonusAllocation }
  | { type: 'markReceived'; eventId: string }
  | { type: 'addReserves'; reserves: Omit<Reserve, 'id'>[] }
  | { type: 'reset' };

export function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'answer':
      return { ...state, answers: { ...state.answers, ...action.patch } };

    case 'setBuckets':
      return { ...state, buckets: action.buckets };

    case 'completeSetup': {
      const paycheck = state.answers.paycheckAmount ?? 0;
      const base = state.buckets.length > 0 ? state.buckets : suggestBuckets(paycheck);
      const buckets = state.buckets.length > 0 ? rescaleBuckets(base, paycheck) : base;
      return {
        ...state,
        setupComplete: true,
        buckets,
        // The POC seeds sample bills so the Ahead view has something to show.
        bills: state.bills.length > 0 ? state.bills : SAMPLE_BILLS,
      };
    }

    case 'loadDemo':
      return structuredClone(DEMO_DATA);

    case 'addPurchase':
      return {
        ...state,
        buckets: state.buckets.map((b) => (b.id === action.bucketId ? { ...b, spent: b.spent + action.amount } : b)),
      };

    case 'markBucketPaid':
      return {
        ...state,
        buckets: state.buckets.map((b) => (b.id === action.bucketId ? { ...b, paidOn: action.dueOn } : b)),
      };

    case 'addIncome':
      return {
        ...state,
        incomeEvents: [{ ...action.event, id: newId('inc'), allocation: null }, ...state.incomeEvents],
      };

    case 'allocateIncome': {
      const event = state.incomeEvents.find((e) => e.id === action.eventId);
      if (!event) return state;
      // Expected money is only planned into a paycheck; buckets change when it actually lands.
      if (event.status === 'expected' && action.allocation.kind !== 'paycheck') return state;
      let buckets = state.buckets;
      const bump = (id: string, amount: number) =>
        buckets.map((b) => (b.id === id ? { ...b, planned: b.planned + amount, spent: b.kind === 'savings' ? b.spent + amount : b.spent } : b));
      const savingsId = buckets.find((b) => b.kind === 'savings')?.id;
      const otherId = buckets.find((b) => b.id === 'other')?.id ?? buckets[buckets.length - 1]?.id;
      switch (action.allocation.kind) {
        case 'savings':
          if (savingsId) buckets = bump(savingsId, event.amount);
          break;
        case 'split': {
          const half = Math.round(event.amount / 2);
          if (savingsId) buckets = bump(savingsId, half);
          if (otherId) buckets = bump(otherId, event.amount - half);
          break;
        }
        case 'paycheck':
        case 'debt':
          // Money folded into a paycheck is assigned by hand on the Buckets screen;
          // a debt payment leaves the budget. Neither changes buckets here.
          break;
      }
      return {
        ...state,
        buckets,
        incomeEvents: state.incomeEvents.map((e) => (e.id === action.eventId ? { ...e, allocation: action.allocation } : e)),
      };
    }

    case 'markReceived':
      return {
        ...state,
        incomeEvents: state.incomeEvents.map((e) => (e.id === action.eventId ? { ...e, status: 'received' } : e)),
      };

    case 'addReserves':
      return { ...state, reserves: [...state.reserves, ...action.reserves.map((r) => ({ ...r, id: newId('res') }))] };

    case 'reset':
      return initialData;
  }
}

interface Store {
  data: AppData;
  answer: (patch: Partial<Answers>) => void;
  setBuckets: (buckets: Bucket[]) => void;
  completeSetup: () => void;
  loadDemo: () => void;
  addPurchase: (bucketId: string, amount: number) => void;
  /** Mark a bucket's due date paid by hand, or pass undefined to unmark it. */
  markBucketPaid: (bucketId: string, dueOn: string | undefined) => void;
  addIncome: (event: Omit<IncomeEvent, 'id' | 'allocation'>) => void;
  allocateIncome: (eventId: string, allocation: BonusAllocation) => void;
  markReceived: (eventId: string) => void;
  addReserves: (reserves: Omit<Reserve, 'id'>[]) => void;
  reset: () => void;
}

const StoreContext = createContext<Store | null>(null);

const defaultRepository = new LocalStorageRepository();

export function StoreProvider({ children, repository = defaultRepository }: { children: ReactNode; repository?: Repository }) {
  const [data, dispatch] = useReducer(reducer, undefined, () => repository.load() ?? initialData);

  useEffect(() => {
    repository.save(data);
  }, [data, repository]);

  const store = useMemo<Store>(
    () => ({
      data,
      answer: (patch) => dispatch({ type: 'answer', patch }),
      setBuckets: (buckets) => dispatch({ type: 'setBuckets', buckets }),
      completeSetup: () => dispatch({ type: 'completeSetup' }),
      loadDemo: () => dispatch({ type: 'loadDemo' }),
      addPurchase: (bucketId, amount) => dispatch({ type: 'addPurchase', bucketId, amount }),
      markBucketPaid: (bucketId, dueOn) => dispatch({ type: 'markBucketPaid', bucketId, dueOn }),
      addIncome: (event) => dispatch({ type: 'addIncome', event }),
      allocateIncome: (eventId, allocation) => dispatch({ type: 'allocateIncome', eventId, allocation }),
      markReceived: (eventId) => dispatch({ type: 'markReceived', eventId }),
      addReserves: (reserves) => dispatch({ type: 'addReserves', reserves }),
      reset: () => {
        repository.clear();
        dispatch({ type: 'reset' });
      },
    }),
    [data, repository],
  );

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

/** Starter bucket names for the preview on the buckets question. */
export const starterBucketNames = STARTER_BUCKETS.map((b) => b.name);
