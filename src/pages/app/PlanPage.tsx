import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { MoneyInput } from '../../components/MoneyInput';
import { dueDateInPeriod, isHourly, planAssigned, planFor, plannedAmount, takeHomeForHours } from '../../domain/plan';
import type { PaycheckPlan } from '../../domain/types';
import { fmtShort, fmtWeekday, ordinalDay } from '../../lib/dates';
import { fmt } from '../../lib/money';
import { useOutlook } from '../../state/selectors';
import { useStore } from '../../state/store';

/**
 * One paycheck's plan: expected take-home and what goes into each bucket.
 * Edits save as they are made; the plan is applied when the paycheck is confirmed on Home.
 */
interface PlanCardProps {
  plan: PaycheckPlan;
  index: number;
  previous: PaycheckPlan | null;
  /** What landed, once this paycheck is confirmed. Its buckets are then the truth and the card is read-only. */
  confirmedAmount: number | null;
  /** Extra money planned into this paycheck. */
  extra: number;
  /** What each saves-up bucket will hold once this paycheck is in, by bucket id. */
  balances: Record<string, number>;
}

function PlanCard({ plan, index, previous, confirmedAmount, extra, balances }: PlanCardProps) {
  const { data, setPlan } = useStore();
  const buckets = data.buckets;
  const assigned = planAssigned(plan, buckets);
  const takeHome = (confirmedAmount ?? plan.takeHome) + extra;
  const left = takeHome - assigned;
  const stored = data.plans.some((p) => p.payday === plan.payday);
  const current = index === 0;
  const readOnly = confirmedAmount !== null;
  const hourly = isHourly(data.answers);

  const setAllocation = (id: string, amount: number | null) => setPlan({ ...plan, allocations: { ...plan.allocations, [id]: amount ?? 0 } });
  const useDefaults = () => setPlan({ ...plan, allocations: Object.fromEntries(buckets.map((b) => [b.id, b.defaultAmount])) });
  const copyPrevious = () => previous && setPlan({ ...plan, takeHome: previous.takeHome, hours: previous.hours, allocations: { ...previous.allocations } });

  return (
    <section className="card stack" style={{ gap: 12, borderColor: current ? 'var(--accent)' : undefined, borderWidth: current ? 1.5 : 1 }} aria-labelledby={`plan-${plan.payday}`}>
      <div className="between" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <span className="stack" style={{ gap: 2 }}>
          <h2 id={`plan-${plan.payday}`} style={{ fontSize: 20 }}>
            {fmtWeekday(plan.payday)}
          </h2>
          <span className="small muted">
            {current ? (readOnly ? `This paycheck, landed ${fmt(confirmedAmount)}` : 'This paycheck, not confirmed yet') : index === 1 ? 'Next paycheck' : 'Coming up'}
            {readOnly ? '' : stored ? '' : ' · using bucket defaults'}
            {extra > 0 ? ` · +${fmt(extra)} extra money` : ''}
          </span>
        </span>
        <span
          className="pill"
          style={{
            background: left === 0 ? 'var(--tint)' : 'var(--warn-bg)',
            color: left === 0 ? 'var(--accent)' : 'var(--warn-text)',
          }}
        >
          {left === 0 ? 'Every dollar has a job' : left > 0 ? `${fmt(left)} unassigned` : `${fmt(-left)} over`}
        </span>
      </div>

      {hourly && !readOnly && (
        <div className="field" style={{ maxWidth: 240 }}>
          <label htmlFor={`hours-${plan.payday}`}>Hours this paycheck</label>
          <MoneyInput
            id={`hours-${plan.payday}`}
            value={plan.hours ?? null}
            onChange={(v) => setPlan({ ...plan, hours: v ?? undefined, takeHome: takeHomeForHours(data.answers, v ?? data.answers.typicalHours ?? 0) })}
            prefix=""
            unit="hrs"
          />
          <span className="small muted">
            {fmt(data.answers.hourlyRate ?? 0)}/hr, netted with your tax details. <Link to="/setup/estimate">Adjust</Link>
          </span>
        </div>
      )}
      <div className="field" style={{ maxWidth: 240 }}>
        <label htmlFor={`take-${plan.payday}`}>{hourly ? 'Take-home for those hours' : 'Expected take-home'}</label>
        {confirmedAmount !== null || hourly ? (
          <div className="input" style={{ background: 'var(--tint)', borderColor: 'transparent' }}>
            <span className="unit">$</span>
            <span style={{ fontWeight: 700 }}>{(confirmedAmount ?? plan.takeHome).toLocaleString('en-US')}</span>
            <span className="small muted">
              {confirmedAmount !== null ? (data.deposit?.hours ? `landed for ${data.deposit.hours} hours` : 'landed') : 'estimated'}
              {extra > 0 ? `, +${fmt(extra)} extra` : ''}
            </span>
          </div>
        ) : (
          <MoneyInput id={`take-${plan.payday}`} value={plan.takeHome} onChange={(v) => setPlan({ ...plan, takeHome: v ?? 0 })} />
        )}
      </div>

      <div className="grid-2" style={{ gap: 10 }}>
        {buckets.map((b) => (
          <div key={b.id} className="field">
            <label htmlFor={`alloc-${plan.payday}-${b.id}`}>
              {b.name}
              {b.dueDay ? <span className="muted" style={{ fontWeight: 600 }}> · due the {ordinalDay(b.dueDay)}</span> : null}
            </label>
            {b.savesUp &&
              (() => {
                const balance = balances[b.id] ?? 0;
                return (
                  <span className="small muted" style={{ order: 3 }}>
                    {balance < 0 ? `Will still be ${fmt(-balance)} short after this paycheck` : `Will hold ${fmt(balance)} after this paycheck`}
                  </span>
                );
              })()}
            {readOnly ? (
              <div className="input" style={{ background: 'var(--tint)', borderColor: 'transparent' }}>
                <span className="unit">$</span>
                <span style={{ fontWeight: 700 }}>{plannedAmount(plan, b).toLocaleString('en-US')}</span>
              </div>
            ) : (
              <MoneyInput id={`alloc-${plan.payday}-${b.id}`} value={plannedAmount(plan, b)} onChange={(v) => setAllocation(b.id, v)} />
            )}
          </div>
        ))}
      </div>

      <div className="between small" style={{ flexWrap: 'wrap', gap: 8 }}>
        <span className="muted">
          {fmt(assigned)} assigned of {fmt(takeHome)}
        </span>
        {readOnly ? (
          <Link to="/app/buckets" className="link small">
            Adjust this paycheck on Buckets
          </Link>
        ) : (
        <span className="row" style={{ gap: 14 }}>
          {previous && (
            <button type="button" className="link small" onClick={copyPrevious}>
              Same as {fmtShort(previous.payday)}
            </button>
          )}
          <button type="button" className="link small" onClick={useDefaults}>
            Use bucket defaults
          </button>
        </span>
        )}
      </div>
    </section>
  );
}

export function PlanPage() {
  const { data, planAnother } = useStore();
  // Plan at least this paycheck and the next, whatever the horizon from setup.
  const base = useOutlook(0).length;
  const outlook = useOutlook(Math.max(0, 2 - base) + data.extraPlanned);
  const plans = outlook.map((s) => {
    const payday = s.period.payday;
    const confirmed = data.deposit?.payday === payday;
    // A confirmed paycheck shows what its buckets actually hold.
    return confirmed
      ? { payday, takeHome: s.period.takeHome, allocations: Object.fromEntries(data.buckets.map((b) => [b.id, b.planned])) }
      : planFor(payday, data.plans, data.buckets, data.answers);
  });

  // A saves-up bucket keeps what it is not spent, so its balance builds across the
  // plans. Future spending is unknown, except that a bucket with a due day is
  // expected to pay out in the paycheck its date falls in, and start over after.
  const saving = data.buckets.filter((b) => b.savesUp);
  const running: Record<string, number> = {};
  for (const b of saving) running[b.id] = (b.carried ?? 0) - b.spent;
  const balances = plans.map((plan, i) => {
    for (const b of saving) running[b.id] += plannedAmount(plan, b);
    const afterThisPaycheck = { ...running };
    for (const b of saving) if (dueDateInPeriod(b.dueDay, outlook[i].period)) running[b.id] = 0;
    return afterThisPaycheck;
  });

  return (
    <main className="shell-main stack" style={{ gap: 18, maxWidth: 760 }}>
      <div className="page-head stack" style={{ gap: 6 }}>
        <h1>Paycheck plan</h1>
        <p className="muted" style={{ fontSize: 15 }}>
          Decide ahead of time where each paycheck goes. Bills that change month to month, or that you save for differently, get their own numbers. When a paycheck lands,
          confirm it on <Link to="/app">This paycheck</Link> and the buckets fill themselves.
        </p>
      </div>
      {plans.map((plan, i) => (
        <PlanCard
          key={plan.payday}
          plan={plan}
          index={i}
          previous={i > 0 ? plans[i - 1] : null}
          confirmedAmount={data.deposit?.payday === plan.payday ? data.deposit.amount : null}
          extra={outlook[i].extraTotal}
          balances={balances[i]}
        />
      ))}
      <button type="button" className="bucket-add" onClick={planAnother}>
        <Icon name="plus" size={16} strokeWidth={2.6} />
        Plan another paycheck
      </button>
    </main>
  );
}
