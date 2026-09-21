import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BucketRow } from '../../components/BucketRow';
import { Icon } from '../../components/Icon';
import { MoneyInput } from '../../components/MoneyInput';
import { bucketDueStatus, bucketsDueInPeriod, extraForPayday, hasMonthlyTarget, projectFunding, suggestSmoothing } from '../../domain/plan';
import { DESKTOP, useMediaQuery } from '../../hooks/useMediaQuery';
import { daysBetween, fmtShort, fmtWeekday, today } from '../../lib/dates';
import { fmt } from '../../lib/money';
import { useOutlook } from '../../state/selectors';
import { useStore } from '../../state/store';
import { AheadPanel, SmoothingCard } from './Ahead';
import { ExtraMoneyPanel } from './ExtraMoney';

export function Home() {
  const { data, addPurchase, markBucketPaid, startNextPaycheck } = useStore();
  const desktop = useMediaQuery(DESKTOP);
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);
  const [bucketId, setBucketId] = useState(data.buckets[0]?.id ?? '');

  const outlook = useOutlook();
  const period = outlook[0]?.period;
  const takeHome = data.answers.paycheckAmount ?? 0;
  const planned = data.buckets.reduce((s, b) => s + b.planned, 0);
  const spent = data.buckets.reduce((s, b) => s + b.spent, 0);
  const extraEvents = extraForPayday(data.incomeEvents, period?.payday ?? null);
  const extra = extraEvents.reduce((s, e) => s + e.amount, 0);
  const extraLabel = extraEvents.map((e) => (e.status === 'expected' ? `${fmt(e.amount)} expected ${fmtShort(e.date)}` : `${fmt(e.amount)} extra`)).join(' + ');
  const waiting = data.incomeEvents.find((e) => e.allocation === null);
  const available = takeHome + extra;
  const left = available - planned;
  const smoothing = suggestSmoothing(outlook);

  const now = today();
  const dueNow = period ? bucketsDueInPeriod(data.buckets, period, now).filter((d) => !d.due.paid) : [];
  const timing = period
    ? period.payday > now
      ? `Starts ${fmtWeekday(period.payday)}.`
      : `${fmtShort(period.payday)} to ${fmtShort(period.end)}. ${Math.max(0, daysBetween(now, period.end))} days left.`
    : '';

  const submit = () => {
    if (amount && amount > 0 && bucketId) {
      addPurchase(bucketId, amount);
      setAmount(null);
      setAdding(false);
    }
  };

  const main = (
    <main className="shell-main stack" style={{ gap: 0 }}>
      <div className="between page-head" style={{ alignItems: 'flex-end', flexWrap: 'wrap', rowGap: 12 }}>
        <span className="stack" style={{ gap: 4 }}>
          <h1>This paycheck</h1>
          <span className="muted" style={{ fontSize: 15 }}>
            {timing}
          </span>
        </span>
        <div className="row" style={{ marginLeft: 'auto' }}>
          <button type="button" className="btn btn-dark" style={{ whiteSpace: 'nowrap' }} onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
            <Icon name="plus" size={16} strokeWidth={2.6} />
            Add a purchase
          </button>
          {!desktop && (
            <Link to="/app/settings" className="icon-btn" aria-label="Settings">
              <Icon name="settings" size={20} />
            </Link>
          )}
        </div>
      </div>

      {adding && (
        <form
          className="card row"
          style={{ marginTop: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="field grow">
            <label htmlFor="purchase-amount">Amount</label>
            <MoneyInput id="purchase-amount" value={amount} onChange={setAmount} />
          </div>
          <div className="field grow">
            <label htmlFor="purchase-bucket">Bucket</label>
            <div className="input">
              <select id="purchase-bucket" value={bucketId} onChange={(e) => setBucketId(e.target.value)}>
                {data.buckets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ minHeight: 48 }} disabled={!amount || amount <= 0}>
            Save
          </button>
        </form>
      )}

      <div className="hero" style={{ marginTop: 20 }}>
        <div className="between" style={{ alignItems: 'flex-start' }}>
          <span className="stack" style={{ gap: 6 }}>
            <span className="eyebrow">{extra > 0 ? 'This paycheck plus extra' : 'Take-home this paycheck'}</span>
            <span className="display amount">{fmt(available)}</span>
            {extra > 0 && (
              <span style={{ fontSize: 14, opacity: 0.9 }}>
                {fmt(takeHome)} take-home + {extraLabel}
              </span>
            )}
          </span>
          <span className="stack" style={{ alignItems: 'flex-end', gap: 8 }}>
            {left === 0 ? (
              <span className="pill">
                <Icon name="check" size={14} strokeWidth={3} />
                Every dollar has a job
              </span>
            ) : (
              <Link to="/app/buckets" className="pill" style={{ color: 'inherit', textDecoration: 'none' }}>
                {left > 0 ? `${fmt(left)} left to assign` : `${fmt(-left)} over`}
              </Link>
            )}
            <span style={{ fontSize: 14, opacity: 0.9 }}>
              {fmt(planned)} planned · {fmt(spent)} spent so far
            </span>
          </span>
        </div>
      </div>

      {!desktop && waiting && data.answers.bonuses !== 'none' && (
        <Link to="/app/extra" className="card row" style={{ marginTop: 12, textDecoration: 'none', color: 'var(--ink)', alignItems: 'flex-start' }}>
          <span className="iconbox clay">
            <Icon name={waiting.status === 'expected' ? 'calendar' : 'star'} />
          </span>
          <span className="stack grow" style={{ gap: 2 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>
              {waiting.status === 'expected' ? `${fmt(waiting.amount)} expected ${fmtShort(waiting.date)}` : `A ${fmt(waiting.amount)} bonus landed`}
            </span>
            <span className="small muted">{waiting.status === 'expected' ? 'Plan it into a paycheck so it counts ahead of time.' : 'Decide where it goes.'}</span>
          </span>
          <span style={{ color: 'var(--accent)', display: 'inline-flex' }}>
            <Icon name="chevronRight" size={20} strokeWidth={2.4} />
          </span>
        </Link>
      )}

      {period && (
        <div className="between" style={{ marginTop: 10, padding: '0 4px' }}>
          <span className="small muted">Paid again? Move on and carry your envelopes forward.</span>
          <button type="button" className="link small" onClick={startNextPaycheck}>
            Start the next paycheck
          </button>
        </div>
      )}

      <div className="between" style={{ marginTop: 22, alignItems: 'baseline' }}>
        <h2>Your buckets</h2>
        <span className="small muted" style={{ fontWeight: 700 }}>
          spent of planned
        </span>
      </div>
      {dueNow.length > 0 && (
        <div className="card warn row" style={{ marginTop: 12, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--warn-text)', display: 'inline-flex', marginTop: 2 }}>
            <Icon name="alert" size={18} strokeWidth={2.4} />
          </span>
          <span style={{ fontSize: 14 }}>
            <b>Due this paycheck:</b>{' '}
            {dueNow.map((d) => `${d.bucket.name} (${d.due.overdue ? 'was due ' : ''}${fmtShort(d.due.dueOn)})`).join(', ')}. Don&rsquo;t forget to pay{' '}
            {dueNow.length === 1 ? 'it' : 'them'}.
          </span>
        </div>
      )}
      <div className="buckets" style={{ marginTop: 12 }}>
        {data.buckets.map((b) => {
          const due = period ? bucketDueStatus(b, period, now) : null;
          const funding = period && hasMonthlyTarget(b) ? projectFunding(b, [period])[0] : null;
          return (
            <BucketRow
              key={b.id}
              bucket={b}
              due={due}
              funding={funding}
              onMarkPaid={due ? (paid) => markBucketPaid(b.id, paid ? due.dueOn : undefined) : undefined}
            />
          );
        })}
        <Link to="/app/buckets" className="bucket-add" style={{ textDecoration: 'none' }}>
          <Icon name="plus" size={16} strokeWidth={2.6} />
          Edit buckets
        </Link>
      </div>
    </main>
  );

  if (!desktop) return main;

  return (
    <div className="with-aside">
      {main}
      <aside className="aside" aria-label="Coming up">
        {data.answers.horizon !== 'this' && <AheadPanel summaries={outlook} buckets={data.buckets} compact />}
        {smoothing && <SmoothingCard smoothing={smoothing} />}
        {data.answers.bonuses !== 'none' && <ExtraMoneyPanel compact />}
      </aside>
    </div>
  );
}
