import { buildOutlook, type PeriodSummary } from '../domain/plan';
import { useStore } from './store';

/** The upcoming paychecks, with bills, reserves and planned extra money applied. */
export function useOutlook(): PeriodSummary[] {
  const { data } = useStore();
  return buildOutlook(data.answers, data.bills, data.reserves, data.incomeEvents);
}

/** Payday of the paycheck the user is in right now, or null before setup. */
export function useCurrentPayday(): string | null {
  const outlook = useOutlook();
  return outlook[0]?.period.payday ?? null;
}
