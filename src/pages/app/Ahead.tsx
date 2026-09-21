import { Link } from 'react-router-dom';
import { buildOutlook, suggestSmoothing, type PeriodSummary, type Smoothing } from '../../domain/plan';
import { fmtShort, fmtWeekday } from '../../lib/dates';
import { fmt } from '../../lib/money';
import { useStore } from '../../state/store';

export function SmoothingCard({ smoothing }: { smoothing: Smoothing }) {
  const { addReserves } = useStore();
  const apply = () =>
    addReserves(smoothing.fromPaydays.map((from) => ({ fromPayday: from, forPayday: smoothing.forPayday, amount: smoothing.perPaycheck })));
  return (
    <div className="card warn stack">
      <span style={{ fontSize: 14 }}>
        <b>Want a smoother month?</b>{' '}
        {smoothing.fromPaydays.length === 1
          ? `Set aside ${fmt(smoothing.perPaycheck)} from the ${fmtShort(smoothing.fromPaydays[0])} paycheck`
          : `Set aside ${fmt(smoothing.perPaycheck)} from each of the ${smoothing.fromPaydays.length} paychecks before it`}{' '}
        and {fmtShort(smoothing.forPayday)} won&rsquo;t feel tight.
      </span>
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn btn-dark" onClick={apply}>
          Do it for me
        </button>
      </div>
    </div>
  );
}

export function AheadPanel({ summaries, compact }: { summaries: PeriodSummary[]; compact?: boolean }) {
  if (compact) {
    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div className="between" style={{ paddingBottom: 10 }}>
          <h2 style={{ fontSize: 20 }}>Ahead</h2>
          <Link to="/app/ahead" className="link small">
            See all
          </Link>
        </div>
        {summaries.map((s) => (
          <div key={s.period.payday} className="between" style={{ padding: '10px 0', borderTop: '1px solid var(--divider)' }}>
            <span className="stack" style={{ gap: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{fmtWeekday(s.period.payday)}</span>
              <span className="small muted">
                {s.bills.length === 0 ? 'No bills due' : `${s.bills.map((b) => b.name).join(', ')} · ${fmt(s.billsTotal)} in bills`}
                {s.extraTotal > 0 ? ` · +${fmt(s.extraTotal)} bonus` : ''}
              </span>
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
                <span style={{ fontWeight: 700 }}>+ {fmt(e.amount)}</span>
              </div>
            ))}
            {s.bills.length === 0 && <span className="small muted">No bills due in this paycheck.</span>}
            {s.bills.map((b) => (
              <div key={b.id} className="between" style={{ fontSize: 14 }}>
                <span>
                  {b.name}, due {fmtShort(b.dueDate)}
                </span>
                <span style={{ fontWeight: 700 }}>{fmt(b.amount)}</span>
              </div>
            ))}
            {s.reserveNet !== 0 && (
              <div className="between muted" style={{ fontSize: 14 }}>
                <span>{s.reserveNet > 0 ? 'Set aside from earlier paychecks' : 'Set aside for a later paycheck'}</span>
                <span style={{ fontWeight: 700 }}>
                  {s.reserveNet > 0 ? '+' : '−'} {fmt(Math.abs(s.reserveNet))}
                </span>
              </div>
            )}
            <div className="between muted" style={{ fontSize: 14 }}>
              <span>Left for buckets</span>
              <span style={{ fontWeight: 700 }}>{fmt(s.leftForBuckets)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Ahead() {
  const { data } = useStore();
  const outlook = buildOutlook(data.answers, data.bills, data.reserves, data.incomeEvents);
  const smoothing = suggestSmoothing(outlook);
  const count = outlook.length;

  return (
    <main className="shell-main stack" style={{ gap: 18 }}>
      <div className="page-head stack" style={{ gap: 6 }}>
        <h1>{count === 1 ? 'This paycheck' : `Your next ${count} paychecks`}</h1>
        <p className="muted" style={{ fontSize: 15 }}>
          Bills are placed in the paycheck that pays them.
        </p>
      </div>
      <AheadPanel summaries={outlook} />
      {smoothing && <SmoothingCard smoothing={smoothing} />}
      {data.answers.horizon === 'this' && (
        <p className="small muted">
          You chose one paycheck at a time. <Link to="/setup/ahead">Show more paychecks</Link>
        </p>
      )}
    </main>
  );
}
