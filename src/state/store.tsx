import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { Answers, AppData, BonusAllocation, Bucket, IncomeEvent, Reserve } from '../domain/types';
import { emptyAnswers } from '../domain/types';
import { rescaleBuckets, suggestBuckets } from '../domain/plan';
import { DEMO_DATA, SAMPLE_BILLS, STARTER_BUCKETS } from '../data/fixtures';
import { newId } from '../lib/money';
import { LocalStorageRepository, type Repository } from './repository';

export const initialData: AppData = {
  version: 1,
  setupComplete: false,
  answers: emptyAnswers,
  buckets: [],
  bills: [],
  incomeEvents: [],
  reserves: [],
};

type Action =
  | { type: 'answer'; patch: Partial<Answers> }
  | { type: 'setBuckets'; buckets: Bucket[] }
  | { type: 'completeSetup' }
  | { type: 'loadDemo' }
  | { type: 'addPurchase'; bucketId: string; amount: number }
  | { type: 'addIncome'; event: Omit<IncomeEvent, 'id' | 'allocation'> }
  | { type: 'allocateIncome'; eventId: string; allocation: BonusAllocation }
  | { type: 'addReserves'; reserves: Omit<Reserve, 'id'>[] }
  | { type: 'reset' };

function reducer(state: AppData, action: Action): AppData {
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

    case 'addIncome':
      return {
        ...state,
        incomeEvents: [{ ...action.event, id: newId('inc'), allocation: null }, ...state.incomeEvents],
      };

    case 'allocateIncome': {
      const event = state.incomeEvents.find((e) => e.id === action.eventId);
      if (!event) return state;
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
        case 'paycheck': {
          const spending = buckets.filter((b) => b.kind === 'spending');
          const total = spending.reduce((s, b) => s + b.planned, 0) || 1;
          let given = 0;
          buckets = buckets.map((b) => {
            if (b.kind !== 'spending') return b;
            const share = Math.round((b.planned / total) * event.amount);
            given += share;
            return { ...b, planned: b.planned + share };
          });
          if (otherId && given !== event.amount) buckets = bump(otherId, event.amount - given);
          break;
        }
        case 'debt':
          // Recorded only; the POC has no debt accounts to pay from.
          break;
      }
      return {
        ...state,
        buckets,
        incomeEvents: state.incomeEvents.map((e) => (e.id === action.eventId ? { ...e, allocation: action.allocation } : e)),
      };
    }

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
  addIncome: (event: Omit<IncomeEvent, 'id' | 'allocation'>) => void;
  allocateIncome: (eventId: string, allocation: BonusAllocation) => void;
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
      addIncome: (event) => dispatch({ type: 'addIncome', event }),
      allocateIncome: (eventId, allocation) => dispatch({ type: 'allocateIncome', eventId, allocation }),
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
