import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { bucketsDueInPeriod, dueDatesInPeriod, type PeriodSummary } from '../../domain/plan';
import type { Bucket } from '../../domain/types';
import { fmtShort, fmtWeekday, today } from '../../lib/dates';
import { planAssigned, planFor } from '../../domain/plan';
import { fmt } from '../../lib/money';
import { useOutlook } from '../../state/selectors';
import { useStore } from '../../state/store';

/** Buckets to flag as due in a paycheck: everything with a due date, minus what is already paid in the current one. */
function dueIn(buckets: Bucket[], s: PeriodSummary, isCurrent: boolean): { bucket: Bucket; dueOn: string }[] {
  if (!isCurrent) return dueDatesInPeriod(buckets, s.period);
  return bucketsDueInPeriod(buckets, s.period, today())
    .filter((d) => !d.due.paid)
    .map((d) => ({ bucket: d.bucket, dueOn: d.due.dueOn }));
}

export function AheadPanel({ summaries, buckets, compact }: { summaries: PeriodSummary[]; buckets: Bucket[]; compact?: boolean }) {
  const { data } = useStore();
  if (compact) {
    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div className="between" style={{ paddingBottom: 10 }}>
          <h2 style={{ fontSize: 20 }}>Ahead</h2>
          <Link to="/app/ahead" className="link small">
            See all
          </Link>
        </div>
        {summaries.map((s, i) => (
          <div key={s.period.payday} className="between" style={{ padding: '10px 0', borderTop: '1px solid var(--divider)' }}>
            <span className="stack" style={{ gap: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{fmtWeekday(s.period.payday)}</span>
              <span className="small muted">
                {s.bills.length === 0 ? 'No bills due' : `${s.bills.map((b) => b.name).join(', ')} · ${fmt(s.billsTotal)} in bills`}
                {s.extraTotal > 0 ? ` · +${fmt(s.extraTotal)} extra` : ''}
              </span>
              {dueIn(buckets, s, i === 0).map(({ bucket, dueOn }) => (
                <span key={bucket.id} className="due" style={{ fontSize: 12 }}>
                  <Icon name="alert" size={12} strokeWidth={2.4} />
                  {bucket.name} due {fmtShort(dueOn)}
                </span>
              ))}
            </span>
            <span className={`status ${s.status}`}>{s.status === 'covered' ? 'Covered' : 'Tight'}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="stack">
      {summaries.map((s, i) => (
        <div key={s.period.payday} className="card stack" style={{ gap: 8, borderColor: i === 0 ? 'var(--accent)' : undefined, borderWidth: i === 0 ? 1.5 : 1 }}>
          <div className="between">
            <span className="stack" style={{ gap: 0 }}>
              <span style={{ fontWeight: 700 }}>{fmtWeekday(s.period.payday)}</span>
              <span className="small muted">{i === 0 ? 'This paycheck' : i === 1 ? 'Next paycheck' : `${fmtShort(s.period.payday)} to ${fmtShort(s.period.end)}`}</span>
            </span>
            <span className="stack" style={{ alignItems: 'flex-end', gap: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 18 }}>{fmt(s.period.takeHome)}</span>
              <span className={`status ${s.status}`}>{s.status === 'covered' ? 'Covered' : 'Tight'}</span>
            </span>
          </div>
          <div className="stack" style={{ gap: 4, paddingTop: 8, borderTop: '1px solid var(--divider)' }}>
            {s.extraIncome.map((e) => (
              <div key={e.id} className="between" style={{ fontSize: 14, color: 'var(--accent)' }}>
                <span>
                  {e.source}
                  {e.status === 'expected' ? `, expected ${fmtShort(e.date)}` : ''}
                </span>
                <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>+ {fmt(e.amount)}</span>
              </div>
            ))}
            {s.bills.length === 0 && <span className="small muted">No bills due in this paycheck.</span>}
            {s.bills.map((b) => (
              <div key={b.id} className="between" style={{ fontSize: 14 }}>
                <span>
                  {b.name}, due {fmtShort(b.dueDate)}
                </span>
                <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(b.amount)}</span>
              </div>
            ))}
            <div className="between muted" style={{ fontSize: 14 }}>
              <span>Left for buckets</span>
              <span style={{ fontWeight: 700 }}>{fmt(s.leftForBuckets)}</span>
            </div>
            {(() => {
              const plan = planFor(s.period.payday, data.plans, buckets, data.answers);
              const assigned = planAssigned(plan, buckets);
              const stored = data.plans.some((p) => p.payday === s.period.payday);
              const have = s.period.takeHome + s.extraTotal;
              const balanced = assigned === have;
              return (
                <Link to="/app/plan" className="between small" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 700 }}>
                  <span>{stored ? 'Planned' : 'Default plan'}: {fmt(assigned)} across {buckets.length} buckets</span>
                  <span style={{ color: balanced ? 'var(--accent)' : 'var(--warn-text)' }}>
                    {balanced ? 'Every dollar has a job' : assigned < have ? `${fmt(have - assigned)} unassigned` : `${fmt(assigned - have)} over`}
                  </span>
                </Link>
              );
            })()}
            {dueIn(buckets, s, i === 0).map(({ bucket, dueOn }) => (
              <div key={bucket.id} className="due" style={{ marginTop: 4 }}>
                <Icon name="alert" size={14} strokeWidth={2.4} />
                {bucket.name} due {fmtShort(dueOn)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Ahead() {
  const { data } = useStore();
  const outlook = useOutlook();
  const count = outlook.length;

  return (
    <main className="shell-main stack" style={{ gap: 18 }}>
      <div className="page-head stack" style={{ gap: 6 }}>
        <h1>{count === 1 ? 'This paycheck' : `Your next ${count} paychecks`}</h1>
        <p className="muted" style={{ fontSize: 15 }}>
          Bills are placed in the paycheck that pays them.
        </p>
      </div>
      <AheadPanel summaries={outlook} buckets={data.buckets} />
      {data.answers.horizon === 'this' && (
        <p className="small muted">
          You chose one paycheck at a time. <Link to="/setup/ahead">Show more paychecks</Link>
        </p>
      )}
    </main>
  );
}
