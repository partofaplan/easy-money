import { buildOutlook, extraForPayday, type PeriodSummary } from '../domain/plan';
import type { IncomeEvent, PayPeriod } from '../domain/types';
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

export interface CurrentPaycheck {
  period: PayPeriod | null;
  /** True once the user confirmed this paycheck landed. */
  confirmed: boolean;
  /** What landed, or what is expected. */
  takeHome: number;
  /** Extra money counted in this paycheck. */
  extraEvents: IncomeEvent[];
  extra: number;
  /** Take-home plus extra: everything the buckets can be filled from. */
  available: number;
  /** Sum of what the buckets are filled with. */
  planned: number;
  /** available minus planned: positive is unassigned, negative is over. */
  left: number;
}

/** The paycheck in progress, with the money maths Home and Buckets both show. */
export function useCurrentPaycheck(): CurrentPaycheck {
  const { data } = useStore();
  const period = useOutlook()[0]?.period ?? null;
  const confirmed = !!period && data.deposit?.payday === period.payday;
  const takeHome = period?.takeHome ?? data.answers.paycheckAmount ?? 0;
  const extraEvents = extraForPayday(data.incomeEvents, period?.payday ?? null);
  const extra = extraEvents.reduce((s, e) => s + e.amount, 0);
  const available = takeHome + extra;
  const planned = data.buckets.reduce((s, b) => s + b.planned, 0);
  return { period, confirmed, takeHome, extraEvents, extra, available, planned, left: available - planned };
}
