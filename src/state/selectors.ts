import { buildOutlook, type PeriodSummary } from '../domain/plan';
import { useStore } from './store';

/** The upcoming paychecks, with bills, reserves, planned extra money and per-paycheck plans applied. */
export function useOutlook(extra = 0): PeriodSummary[] {
  const { data } = useStore();
  return buildOutlook({
    answers: data.answers,
    bills: data.bills,
    reserves: data.reserves,
    events: data.incomeEvents,
    plans: data.plans,
    deposit: data.deposit,
    extra,
  });
}

/** Payday of the paycheck the user is in right now, or null before setup. */
export function useCurrentPayday(): string | null {
  const outlook = useOutlook();
  return outlook[0]?.period.payday ?? null;
}
