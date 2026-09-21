import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { Answers, AppData, BonusAllocation, Bucket, IncomeEvent, PaycheckPlan } from '../domain/types';
import { emptyAnswers } from '../domain/types';
import { fillFromPlan, nextPayday, planFor, rescaleBuckets, suggestBuckets } from '../domain/plan';
import { DEMO_DATA, SAMPLE_BILLS, STARTER_BUCKETS } from '../data/fixtures';
import { newId } from '../lib/money';
import { LocalStorageRepository, type Repository } from './repository';

export const initialData: AppData = {
  version: 3,
  setupComplete: false,
  answers: emptyAnswers,
  buckets: [],
  bills: [],
  incomeEvents: [],
  plans: [],
  deposit: null,
  extraPlanned: 0,
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
  | { type: 'setPlan'; plan: PaycheckPlan }
  | { type: 'planAnother' }
  | { type: 'confirmPaycheck'; payday: string; amount: number }
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

    case 'setPlan':
      return {
        ...state,
        plans: [...state.plans.filter((p) => p.payday !== action.plan.payday), action.plan].sort((a, b) => a.payday.localeCompare(b.payday)),
      };

    case 'planAnother':
      return { ...state, extraPlanned: state.extraPlanned + 1 };

    case 'confirmPaycheck': {
      const { payFrequency, nextPayday: current } = state.answers;
      if (!payFrequency || !current) return state;
      const plan = planFor(action.payday, state.plans, state.buckets, state.answers);
      const deposit = { payday: action.payday, amount: action.amount };
      // Once a paycheck is confirmed its buckets are the truth; the stored plan is dropped.
      const remaining = state.plans.filter((p) => p.payday > action.payday);
      if (action.payday === current) {
        // The paycheck already in progress: record what landed and fill the buckets.
        return { ...state, deposit, plans: remaining, buckets: fillFromPlan(state.buckets, plan) };
      }
      // Irregular pay has no fixed next date, so any later date counts; otherwise it must be the next payday.
      const isNext = payFrequency === 'irregular' ? action.payday > current : action.payday === nextPayday(current, payFrequency);
      if (isNext) {
        // The next paycheck landed: move to it, fill buckets, start spending fresh.
        return {
          ...state,
          answers: { ...state.answers, nextPayday: action.payday },
          deposit,
          buckets: fillFromPlan(state.buckets, plan).map((b) => ({ ...b, spent: 0, paidOn: undefined })),
          plans: remaining,
          extraPlanned: Math.max(0, state.extraPlanned - 1),
        };
      }
      return state;
    }

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
  setPlan: (plan: PaycheckPlan) => void;
  planAnother: () => void;
  /** Confirm a paycheck landed with `amount`, filling buckets from its plan. */
  confirmPaycheck: (payday: string, amount: number) => void;
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
      setPlan: (plan) => dispatch({ type: 'setPlan', plan }),
      planAnother: () => dispatch({ type: 'planAnother' }),
      confirmPaycheck: (payday, amount) => dispatch({ type: 'confirmPaycheck', payday, amount }),
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
