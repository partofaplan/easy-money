import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BucketRow } from '../../components/BucketRow';
import { Icon } from '../../components/Icon';
import { MoneyInput } from '../../components/MoneyInput';
import { bucketDueStatus, bucketsDueInPeriod, extraTotalForPayday, nextPayday, planAssigned, planFor } from '../../domain/plan';
import { DESKTOP, useMediaQuery } from '../../hooks/useMediaQuery';
import { addDays, daysBetween, fmtShort, fmtWeekday, today } from '../../lib/dates';
import { fmt } from '../../lib/money';
import { useCurrentPaycheck, useOutlook } from '../../state/selectors';
import { useStore } from '../../state/store';
import { AheadPanel } from './Ahead';
import { ExtraMoneyPanel } from './ExtraMoney';

export function Home() {
  const { data, addPurchase, markBucketPaid, confirmPaycheck } = useStore();
  const desktop = useMediaQuery(DESKTOP);
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);
  const [bucketId, setBucketId] = useState(data.buckets[0]?.id ?? '');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [landed, setLanded] = useState<number | null>(null);
  const [landedOn, setLandedOn] = useState<string>('');

  const outlook = useOutlook();
  const { period: current, confirmed, takeHome, extraEvents, extra, planned, left } = useCurrentPaycheck();
  const period = current ?? undefined;
  const now = today();
  const irregular = data.answers.payFrequency === 'irregular';
  const following = period && data.answers.payFrequency ? nextPayday(period.payday, data.answers.payFrequency) : null;
  // Which paycheck the confirm card is about: the current one until it is confirmed, then the next.
  // For irregular pay the next date is whatever the user enters.
  const toConfirm = period ? (confirmed ? (irregular && landedOn ? landedOn : following) : period.payday) : null;
  const planToConfirm = toConfirm ? planFor(toConfirm, data.plans, data.buckets, data.answers) : null;
  const assignedToConfirm = planToConfirm ? planAssigned(planToConfirm, data.buckets) : 0;
  const extraToConfirm = toConfirm ? extraTotalForPayday(data.incomeEvents, toConfirm) : 0;
  const planGap = planToConfirm ? planToConfirm.takeHome + extraToConfirm - assignedToConfirm : 0;
  const spent = data.buckets.reduce((s, b) => s + b.spent, 0);
  const extraLabel = extraEvents.map((e) => (e.status === 'expected' ? `${fmt(e.amount)} expected ${fmtShort(e.date)}` : `${fmt(e.amount)} extra`)).join(' + ');
  const waiting = data.incomeEvents.find((e) => e.allocation === null);
  const available = takeHome + extra;

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

      {toConfirm && planToConfirm && (
        <div className={`card ${confirmed ? '' : 'tint'} stack`} style={{ marginTop: 16, gap: 10 }}>
          <div className="between" style={{ alignItems: 'flex-start' }}>
            <span className="stack" style={{ gap: 2 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>
                {confirmed ? `Next paycheck ${fmtWeekday(toConfirm)}` : `Has your ${fmtWeekday(toConfirm)} paycheck landed?`}
              </span>
              <span className="small muted">
                Planned {fmt(planToConfirm.takeHome)}
                {extraToConfirm > 0 ? ` + ${fmt(extraToConfirm)} extra` : ''} · {fmt(assignedToConfirm)} assigned across {data.buckets.length} buckets.{' '}
                {planGap !== 0 && (
                  <span style={{ color: 'var(--warn-text)', fontWeight: 700 }}>{planGap > 0 ? `${fmt(planGap)} unassigned. ` : `${fmt(-planGap)} over. `}</span>
                )}
                <Link to="/app/plan">Adjust the plan</Link>
              </span>
            </span>
            {confirming !== toConfirm && (
              <button
                type="button"
                className={`btn btn-sm ${confirmed ? 'btn-outline' : 'btn-primary'}`}
                style={{ minHeight: 40, flexShrink: 0 }}
                onClick={() => {
                  setConfirming(toConfirm);
                  setLanded(planToConfirm.takeHome);
                  if (irregular && confirmed) setLandedOn(following ?? addDays(period!.payday, 14));
                }}
              >
                It landed
              </button>
            )}
          </div>
          {confirming === toConfirm && (
            <form
              className="row"
              style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}
              onSubmit={(e) => {
                e.preventDefault();
                if (!landed || landed <= 0) return;
                const early = confirmed && toConfirm > now;
                if (
                  !early ||
                  window.confirm(`${fmtWeekday(toConfirm)} is ${daysBetween(now, toConfirm)} days away. Confirm anyway? This starts a new paycheck and resets this one's spending.`)
                ) {
                  confirmPaycheck(toConfirm, landed);
                  setConfirming(null);
                }
              }}
            >
              {irregular && confirmed && (
                <div className="field">
                  <label htmlFor="landed-on">Paid on</label>
                  <div className="input">
                    <input id="landed-on" type="date" value={landedOn} min={addDays(period!.payday, 1)} onChange={(e) => setLandedOn(e.target.value)} />
                  </div>
                </div>
              )}
              <div className="field grow">
                <label htmlFor="landed">What actually landed</label>
                <MoneyInput id="landed" value={landed} onChange={setLanded} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ minHeight: 48 }} disabled={!landed || landed <= 0}>
                Fill my buckets
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirming(null)}>
                Not yet
              </button>
              {landed !== null && landed > 0 && (() => {
                const after = landed + extraToConfirm - assignedToConfirm;
                if (after === 0) return null;
                return (
                  <span className="small muted" style={{ flexBasis: '100%' }}>
                    {landed !== planToConfirm.takeHome
                      ? `${fmt(Math.abs(landed - planToConfirm.takeHome))} ${landed > planToConfirm.takeHome ? 'more' : 'less'} than planned. `
                      : ''}
                    {after > 0 ? `You'll have ${fmt(after)} left to assign.` : `The buckets will be ${fmt(-after)} over; trim one after.`}
                  </span>
                );
              })()}
            </form>
          )}
        </div>
      )}

      <div className="hero" style={{ marginTop: 20 }}>
        <div className="between" style={{ alignItems: 'flex-start' }}>
          <span className="stack" style={{ gap: 6 }}>
            <span className="eyebrow">{extra > 0 ? 'This paycheck plus extra' : confirmed ? 'Landed this paycheck' : 'Expected this paycheck'}</span>
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
          return (
            <BucketRow
              key={b.id}
              bucket={b}
              due={due}
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
        {data.answers.bonuses !== 'none' && <ExtraMoneyPanel compact />}
      </aside>
    </div>
  );
}
