import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BucketRow } from '../../components/BucketRow';
import { Icon } from '../../components/Icon';
import { MoneyInput } from '../../components/MoneyInput';
import { buildOutlook, extraForCurrentPaycheck, suggestSmoothing } from '../../domain/plan';
import { DESKTOP, useMediaQuery } from '../../hooks/useMediaQuery';
import { daysBetween, fmtShort, fmtWeekday, today } from '../../lib/dates';
import { fmt } from '../../lib/money';
import { useStore } from '../../state/store';
import { AheadPanel, SmoothingCard } from './Ahead';
import { ExtraMoneyPanel } from './ExtraMoney';

export function Home() {
  const { data, addPurchase } = useStore();
  const desktop = useMediaQuery(DESKTOP);
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);
  const [bucketId, setBucketId] = useState(data.buckets[0]?.id ?? '');

  const outlook = buildOutlook(data.answers, data.bills, data.reserves, data.incomeEvents);
  const period = outlook[0]?.period;
  const takeHome = data.answers.paycheckAmount ?? 0;
  const planned = data.buckets.reduce((s, b) => s + b.planned, 0);
  const spent = data.buckets.reduce((s, b) => s + b.spent, 0);
  const extra = extraForCurrentPaycheck(data.incomeEvents, period?.payday ?? null);
  const available = takeHome + extra;
  const left = available - planned;
  const smoothing = suggestSmoothing(outlook);

  const now = today();
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
                {fmt(takeHome)} take-home + {fmt(extra)} extra money
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

      <div className="between" style={{ marginTop: 22, alignItems: 'baseline' }}>
        <h2>Your buckets</h2>
        <span className="small muted" style={{ fontWeight: 700 }}>
          spent of planned
        </span>
      </div>
      <div className="buckets" style={{ marginTop: 12 }}>
        {data.buckets.map((b) => (
          <BucketRow key={b.id} bucket={b} />
        ))}
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
        {data.answers.horizon !== 'this' && <AheadPanel summaries={outlook} compact />}
        {smoothing && <SmoothingCard smoothing={smoothing} />}
        {data.answers.bonuses !== 'none' && <ExtraMoneyPanel compact />}
      </aside>
    </div>
  );
}
