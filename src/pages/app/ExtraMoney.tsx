import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { MoneyInput } from '../../components/MoneyInput';
import { OptionCard } from '../../components/OptionCard';
import { SAMPLE_BALANCES } from '../../data/fixtures';
import { buildOutlook, periodForDate, type PeriodSummary } from '../../domain/plan';
import type { BonusAllocation, IncomeEvent } from '../../domain/types';
import { fmtShort, fmtWeekday, today } from '../../lib/dates';
import { fmt } from '../../lib/money';
import { useStore } from '../../state/store';

function allocationLabel(a: BonusAllocation): string {
  switch (a.kind) {
    case 'savings':
      return 'Savings';
    case 'debt':
      return 'Paying down a debt';
    case 'split':
      return 'Split between savings and spending';
    case 'paycheck':
      return `Added to the ${fmtShort(a.payday)} paycheck`;
  }
}

function useOutlook(): PeriodSummary[] {
  const { data } = useStore();
  return buildOutlook(data.answers, data.bills, data.reserves, data.incomeEvents);
}

/** A received bonus waiting for a decision. */
function Decide({ event, currentPayday }: { event: IncomeEvent; currentPayday: string | null }) {
  const { allocateIncome } = useStore();
  const [choice, setChoice] = useState<BonusAllocation['kind']>('savings');
  const options: { kind: BonusAllocation['kind']; title: string; sub: string; badge?: string }[] = [
    {
      kind: 'savings',
      title: 'Savings',
      sub: `Your cushion grows from ${fmt(SAMPLE_BALANCES.savings)} to ${fmt(SAMPLE_BALANCES.savings + event.amount)}.`,
      badge: 'Suggested',
    },
    { kind: 'debt', title: 'Pay down a debt', sub: `Credit card balance is ${fmt(SAMPLE_BALANCES.creditCard)}.` },
    { kind: 'split', title: 'Split it up', sub: 'Half to savings, half to everything else.' },
    { kind: 'paycheck', title: 'Add it to this paycheck', sub: 'More to assign across your buckets this paycheck.' },
  ];
  const apply = () => {
    if (choice === 'paycheck') {
      if (!currentPayday) return;
      allocateIncome(event.id, { kind: 'paycheck', payday: currentPayday });
    } else {
      allocateIncome(event.id, { kind: choice });
    }
  };
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="hero clay">
        <span className="eyebrow row" style={{ gap: 8 }}>
          <Icon name="star" size={16} strokeWidth={2.2} />A bonus landed
        </span>
        <span className="display amount">{fmt(event.amount)}</span>
        <span style={{ fontSize: 14, opacity: 0.9 }}>
          Deposit from {event.source} on {fmtShort(event.date)}
        </span>
      </div>
      <h2 style={{ fontSize: 24 }}>It&rsquo;s not part of your everyday plan. Where should it go?</h2>
      <div className="stack">
        {options.map((o) => (
          <OptionCard key={o.kind} selected={choice === o.kind} onSelect={() => setChoice(o.kind)} title={o.title} sub={o.sub} badge={o.badge} />
        ))}
      </div>
      <button type="button" className="btn btn-primary" onClick={apply}>
        {choice === 'savings' ? 'Put it in savings' : choice === 'debt' ? 'Pay down the card' : choice === 'split' ? 'Split it' : 'Add it to this paycheck'}
      </button>
    </div>
  );
}

/** Money the user knows is coming. It can be planned into one upcoming paycheck. */
function Expected({ event, outlook }: { event: IncomeEvent; outlook: PeriodSummary[] }) {
  const { allocateIncome, markReceived } = useStore();
  const periods = outlook.map((s) => s.period);
  const planned = event.allocation?.kind === 'paycheck' ? event.allocation.payday : null;
  const [editing, setEditing] = useState(planned === null);
  const [payday, setPayday] = useState<string>(planned ?? periodForDate(periods, event.date)?.payday ?? periods[0]?.payday ?? '');
  const landsBeyond = periodForDate(periods, event.date) === null;

  return (
    <div className="card stack" style={{ gap: 12, borderColor: 'var(--clay)' }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <span className="iconbox clay" style={{ width: 38, height: 38, borderRadius: 12 }}>
          <Icon name="calendar" size={20} />
        </span>
        <span className="stack grow" style={{ gap: 2 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>
            {fmt(event.amount)} from {event.source}
          </span>
          <span className="small muted">Expected {fmtWeekday(event.date)}</span>
        </span>
      </div>

      {editing ? (
        <div className="stack" style={{ gap: 8 }}>
          <div className="field">
            <label htmlFor={`plan-${event.id}`}>Which paycheck should count on it?</label>
            <div className="input">
              <select id={`plan-${event.id}`} value={payday} onChange={(e) => setPayday(e.target.value)}>
                {periods.map((p) => (
                  <option key={p.payday} value={p.payday}>
                    {fmtWeekday(p.payday)} paycheck ({fmtShort(p.payday)} to {fmtShort(p.end)})
                  </option>
                ))}
              </select>
            </div>
            {landsBeyond && (
              <span className="small muted">
                It lands after the paychecks you plan for. Pick the one that should count on it, or leave it until it arrives.
              </span>
            )}
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ minHeight: 48 }}
              disabled={!payday}
              onClick={() => {
                allocateIncome(event.id, { kind: 'paycheck', payday });
                setEditing(false);
              }}
            >
              Plan it into that paycheck
            </button>
            {planned && (
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="between" style={{ flexWrap: 'wrap' }}>
          <span className="row" style={{ gap: 8, color: 'var(--accent)', fontWeight: 700, fontSize: 14 }}>
            <Icon name="check" size={16} strokeWidth={3} />
            Counted in the {planned ? fmtShort(planned) : ''} paycheck
          </span>
          <button type="button" className="link small" onClick={() => setEditing(true)}>
            Change
          </button>
        </div>
      )}

      <div className="row" style={{ paddingTop: 4, borderTop: '1px solid var(--divider)', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-sm btn-outline" style={{ minHeight: 40 }} onClick={() => markReceived(event.id)}>
          It landed
        </button>
        <span className="small muted">
          {planned ? 'It stays counted in that paycheck once it lands.' : 'You can decide where it goes once it lands.'}
        </span>
      </div>
    </div>
  );
}

function AddIncome() {
  const { addIncome } = useStore();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [date, setDate] = useState(today());
  const expected = date > today();
  if (!open) {
    return (
      <button type="button" className="bucket-add" onClick={() => setOpen(true)}>
        <Icon name="plus" size={16} strokeWidth={2.6} />
        Record extra money, received or expected
      </button>
    );
  }
  return (
    <form
      className="card stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (amount && amount > 0 && date) {
          addIncome({ source: source.trim() || 'Extra money', amount, date, status: expected ? 'expected' : 'received' });
          setSource('');
          setAmount(null);
          setDate(today());
          setOpen(false);
        }
      }}
    >
      <div className="field">
        <label htmlFor="inc-source">Where from</label>
        <div className="input">
          <input id="inc-source" value={source} placeholder="Overtime, a gift, a quarterly bonus" onChange={(e) => setSource(e.target.value)} />
        </div>
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="inc-amount">Amount</label>
          <MoneyInput id="inc-amount" value={amount} onChange={setAmount} />
        </div>
        <div className="field">
          <label htmlFor="inc-date">{expected ? 'Expected on' : 'Received on'}</label>
          <div className="input">
            <input id="inc-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
      </div>
      <span className="small muted">
        {expected ? 'A future date means we plan for it: pick the paycheck it should count in next.' : 'Money that has already arrived gets a decision right away.'}
      </span>
      <div className="row">
        <button type="submit" className="btn btn-primary" style={{ minHeight: 48 }} disabled={!amount || amount <= 0 || !date}>
          Add
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Compact card for the desktop right rail. */
export function ExtraMoneyPanel({ compact }: { compact?: boolean }) {
  const { data } = useStore();
  const pending = data.incomeEvents.filter((e) => e.status === 'received' && e.allocation === null);
  const unplanned = data.incomeEvents.filter((e) => e.status === 'expected' && e.allocation === null);
  if (!compact) return null;
  const first = pending[0];
  const next = unplanned[0];
  return (
    <div className="card stack" style={{ gap: 12 }}>
      {first ? (
        <>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <span className="iconbox clay" style={{ width: 38, height: 38, borderRadius: 12 }}>
              <Icon name="star" size={20} />
            </span>
            <span className="stack" style={{ gap: 2 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>A {fmt(first.amount)} bonus landed</span>
              <span className="small muted">
                Deposit from {first.source} on {fmtShort(first.date)}. It&rsquo;s not in your everyday plan yet.
              </span>
            </span>
          </div>
          <Link to="/app/extra" className="btn btn-clay btn-sm" style={{ minHeight: 44 }}>
            Decide where it goes
          </Link>
        </>
      ) : next ? (
        <>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <span className="iconbox clay" style={{ width: 38, height: 38, borderRadius: 12 }}>
              <Icon name="calendar" size={20} />
            </span>
            <span className="stack" style={{ gap: 2 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{fmt(next.amount)} expected {fmtShort(next.date)}</span>
              <span className="small muted">From {next.source}. Plan it into a paycheck so it counts ahead of time.</span>
            </span>
          </div>
          <Link to="/app/extra" className="btn btn-outline btn-sm" style={{ minHeight: 44 }}>
            Plan it in
          </Link>
        </>
      ) : (
        <>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Extra money</span>
          <span className="small muted">Nothing waiting for a decision. Bonuses and other extra deposits show up here.</span>
          <Link to="/app/extra" className="link small">
            Record extra money
          </Link>
        </>
      )}
    </div>
  );
}

export function ExtraMoney() {
  const { data } = useStore();
  const outlook = useOutlook();
  const currentPayday = outlook[0]?.period.payday ?? data.answers.nextPayday;
  const pending = data.incomeEvents.filter((e) => e.status === 'received' && e.allocation === null);
  const expected = data.incomeEvents.filter((e) => e.status === 'expected').sort((a, b) => a.date.localeCompare(b.date));
  const decided = data.incomeEvents.filter((e) => e.status === 'received' && e.allocation !== null);

  return (
    <main className="shell-main stack" style={{ gap: 18 }}>
      <div className="page-head stack" style={{ gap: 6 }}>
        <h1>Extra money</h1>
        <p className="muted" style={{ fontSize: 15 }}>
          Money that isn&rsquo;t your paycheck. Each one gets a decision, so it never quietly disappears.
        </p>
      </div>

      {pending.map((e) => (
        <Decide key={e.id} event={e} currentPayday={currentPayday} />
      ))}
      {pending.length === 0 && expected.length === 0 && (
        <div className="card tint stack">
          <span style={{ fontWeight: 700 }}>Nothing waiting for a decision.</span>
          <span className="muted" style={{ fontSize: 14 }}>
            When a bonus or other deposit shows up, it lands here first. Know one is coming? Record it with a future date and plan it into a paycheck.
          </span>
        </div>
      )}

      {expected.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <span className="eyebrow">Coming up</span>
          {expected.map((e) => (
            <Expected key={e.id} event={e} outlook={outlook} />
          ))}
        </div>
      )}

      <AddIncome />

      {decided.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <span className="eyebrow">Already decided</span>
          <div className="list-card">
            {decided.map((e) => (
              <div key={e.id} className="list-row">
                <span className="stack grow" style={{ gap: 2 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>
                    {fmt(e.amount)} from {e.source}
                  </span>
                  <span className="small muted">
                    {fmtShort(e.date)} · {e.allocation ? allocationLabel(e.allocation) : ''}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
