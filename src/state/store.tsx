import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import type { Answers, AppData, BonusAllocation, Bucket, IncomeEvent, PaycheckPlan } from '../domain/types';
import { emptyAnswers } from '../domain/types';
import { defaultTakeHome, fillFromPlan, nextPayday, planFor, rescaleBuckets, suggestBuckets } from '../domain/plan';
import { DEMO_DATA, SAMPLE_BILLS, STARTER_BUCKETS } from '../data/fixtures';
import { newId } from '../lib/money';
import type { Repository } from './repository';
import { registerFlush } from './pendingSaves';

export const initialData: AppData = {
  version: 5,
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
  | { type: 'confirmPaycheck'; payday: string; amount: number; hours?: number }
  | { type: 'reset' }
  | { type: 'hydrate'; data: AppData };

export function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'answer':
      return { ...state, answers: { ...state.answers, ...action.patch } };

    case 'setBuckets':
      return { ...state, buckets: action.buckets };

    case 'completeSetup': {
      const paycheck = defaultTakeHome(state.answers);
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
      const deposit = { payday: action.payday, amount: action.amount, ...(action.hours ? { hours: action.hours } : {}) };
      // Once a paycheck is confirmed its buckets are the truth; the stored plan is dropped.
      const remaining = state.plans.filter((p) => p.payday > action.payday);
      if (action.payday === current) {
        // The paycheck already in progress: record what landed and fill the buckets.
        return { ...state, deposit, plans: remaining, buckets: fillFromPlan(state.buckets, plan) };
      }
      // Irregular pay has no fixed next date, so any later date counts; otherwise it must be the next payday.
      const isNext = payFrequency === 'irregular' ? action.payday > current : action.payday === nextPayday(current, payFrequency, state.answers.semimonthlyDays);
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

    case 'hydrate':
      return action.data;
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
  confirmPaycheck: (payday: string, amount: number, hours?: number) => void;
  reset: () => void;
}

const StoreContext = createContext<Store | null>(null);

interface StoreProviderProps {
  children: ReactNode;
  repository: Repository;
  /** Shown while the budget loads. */
  fallback?: ReactNode;
}

const SAVE_DELAY_MS = 400;

export function StoreProvider({ children, repository, fallback = null }: StoreProviderProps) {
  const [data, dispatch] = useReducer(reducer, initialData);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // What still needs writing. `dirty` is false right after a load and after a reset.
  const latest = useRef(data);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  latest.current = data;

  const flush = useMemo(
    () => async () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      if (!dirty.current) return;
      dirty.current = false;
      try {
        await repository.save(latest.current);
        setSaveError(null);
      } catch (err) {
        dirty.current = true;
        console.error('Saving the budget failed', err);
        setSaveError('Your last change could not be saved. Check your connection; we will keep trying.');
        throw err;
      }
    },
    [repository],
  );

  // Load once per repository (each profile gets its own provider instance).
  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    repository
      .load()
      .then((loaded) => {
        if (cancelled) return;
        dispatch({ type: 'hydrate', data: loaded ?? initialData });
        dirty.current = false;
        setPhase('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('Loading the budget failed', err);
        setLoadError(err instanceof Error ? err.message : 'Could not load your budget.');
        setPhase('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [repository, attempt]);

  // Save shortly after each change so a burst of edits is one write.
  useEffect(() => {
    if (phase !== 'ready' || !dirty.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flush().catch(() => undefined);
    }, SAVE_DELAY_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [data, phase, flush]);

  // Anything still pending is written when the page is left, on sign-out or
  // profile switch (via the registry), and when this provider unmounts.
  useEffect(() => {
    const unregister = registerFlush(flush);
    const onHide = () => {
      void flush().catch(() => undefined);
    };
    window.addEventListener('pagehide', onHide);
    return () => {
      unregister();
      window.removeEventListener('pagehide', onHide);
      void flush().catch(() => undefined);
    };
  }, [flush]);

  // Every action except hydrate/reset marks the budget dirty.
  const act = useMemo(
    () => (action: Action) => {
      dirty.current = true;
      dispatch(action);
    },
    [],
  );

  const store = useMemo<Store>(
    () => ({
      data,
      answer: (patch) => act({ type: 'answer', patch }),
      setBuckets: (buckets) => act({ type: 'setBuckets', buckets }),
      completeSetup: () => act({ type: 'completeSetup' }),
      loadDemo: () => act({ type: 'loadDemo' }),
      addPurchase: (bucketId, amount) => act({ type: 'addPurchase', bucketId, amount }),
      markBucketPaid: (bucketId, dueOn) => act({ type: 'markBucketPaid', bucketId, dueOn }),
      addIncome: (event) => act({ type: 'addIncome', event }),
      allocateIncome: (eventId, allocation) => act({ type: 'allocateIncome', eventId, allocation }),
      markReceived: (eventId) => act({ type: 'markReceived', eventId }),
      setPlan: (plan) => act({ type: 'setPlan', plan }),
      planAnother: () => act({ type: 'planAnother' }),
      confirmPaycheck: (payday, amount, hours) => act({ type: 'confirmPaycheck', payday, amount, hours }),
      reset: () => {
        // Nothing pending should be written after the clear.
        if (timer.current) clearTimeout(timer.current);
        dirty.current = false;
        dispatch({ type: 'reset' });
        void repository.clear().catch((err: unknown) => console.error('Clearing the budget failed', err));
      },
    }),
    [data, act, repository],
  );

  if (phase === 'loading') return <>{fallback}</>;
  if (phase === 'failed') {
    return (
      <div className="welcome">
        <div className="welcome-copy stack" style={{ justifyContent: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 26 }}>Couldn&rsquo;t open this budget.</h1>
          <p className="muted">{loadError}</p>
          <p className="small muted">Nothing has been changed. Check your connection and try again.</p>
          <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </div>
      </div>
    );
  }
  return (
    <StoreContext.Provider value={store}>
      {saveError && (
        <div role="alert" className="card warn small" style={{ borderRadius: 0, textAlign: 'center' }}>
          {saveError}
        </div>
      )}
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

/** Starter bucket names for the preview on the buckets question. */
export const starterBucketNames = STARTER_BUCKETS.map((b) => b.name);
