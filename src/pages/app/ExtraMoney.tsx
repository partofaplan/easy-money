import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { MoneyInput } from '../../components/MoneyInput';
import { OptionCard } from '../../components/OptionCard';
import { SAMPLE_BALANCES } from '../../data/fixtures';
import type { BonusAllocation, IncomeEvent } from '../../domain/types';
import { fmtShort, today } from '../../lib/dates';
import { fmt } from '../../lib/money';
import { useStore } from '../../state/store';

const LABEL: Record<BonusAllocation['kind'], string> = {
  savings: 'Savings',
  debt: 'Paying down a debt',
  split: 'Split between savings and spending',
  paycheck: 'Added to this paycheck',
};

function Decide({ event }: { event: IncomeEvent }) {
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
    { kind: 'paycheck', title: 'Add it to this paycheck', sub: 'Spread it across your spending buckets.' },
  ];
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="hero clay">
        <span className="eyebrow row" style={{ gap: 8 }}>
          <Icon name="star" size={16} strokeWidth={2.2} />A bonus landed
        </span>
        <span className="display amount">{fmt(event.amount)}</span>
        <span style={{ fontSize: 14, opacity: 0.9 }}>
          Deposit from {event.source} on {fmtShort(event.receivedOn)}
        </span>
      </div>
      <h2 style={{ fontSize: 24 }}>It&rsquo;s not part of your everyday plan. Where should it go?</h2>
      <div className="stack">
        {options.map((o) => (
          <OptionCard key={o.kind} selected={choice === o.kind} onSelect={() => setChoice(o.kind)} title={o.title} sub={o.sub} badge={o.badge} />
        ))}
      </div>
      <button type="button" className="btn btn-primary" onClick={() => allocateIncome(event.id, { kind: choice })}>
        {choice === 'savings' ? 'Put it in savings' : choice === 'debt' ? 'Pay down the card' : choice === 'split' ? 'Split it' : 'Add it to this paycheck'}
      </button>
    </div>
  );
}

function AddIncome() {
  const { addIncome } = useStore();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  if (!open) {
    return (
      <button type="button" className="bucket-add" onClick={() => setOpen(true)}>
        <Icon name="plus" size={16} strokeWidth={2.6} />
        Record extra money
      </button>
    );
  }
  return (
    <form
      className="card stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (amount && amount > 0) {
          addIncome({ source: source.trim() || 'Extra money', amount, receivedOn: today() });
          setSource('');
          setAmount(null);
          setOpen(false);
        }
      }}
    >
      <div className="field">
        <label htmlFor="inc-source">Where from</label>
        <div className="input">
          <input id="inc-source" value={source} placeholder="Overtime, a gift, a side gig" onChange={(e) => setSource(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="inc-amount">Amount</label>
        <MoneyInput id="inc-amount" value={amount} onChange={setAmount} />
      </div>
      <div className="row">
        <button type="submit" className="btn btn-primary" style={{ minHeight: 48 }} disabled={!amount || amount <= 0}>
          Add
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ExtraMoneyPanel({ compact }: { compact?: boolean }) {
  const { data } = useStore();
  const pending = data.incomeEvents.filter((e) => e.allocation === null);
  if (!compact) return null;
  const first = pending[0];
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
                Deposit from {first.source} on {fmtShort(first.receivedOn)}. It&rsquo;s not in your everyday plan yet.
              </span>
            </span>
          </div>
          <Link to="/app/extra" className="btn btn-clay btn-sm" style={{ minHeight: 44 }}>
            Decide where it goes
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
  const pending = data.incomeEvents.filter((e) => e.allocation === null);
  const decided = data.incomeEvents.filter((e) => e.allocation !== null);

  return (
    <main className="shell-main stack" style={{ gap: 18 }}>
      <div className="page-head stack" style={{ gap: 6 }}>
        <h1>Extra money</h1>
        <p className="muted" style={{ fontSize: 15 }}>
          Money that isn&rsquo;t your paycheck. Each one gets a decision, so it never quietly disappears.
        </p>
      </div>
      {pending.map((e) => (
        <Decide key={e.id} event={e} />
      ))}
      {pending.length === 0 && (
        <div className="card tint stack">
          <span style={{ fontWeight: 700 }}>Nothing waiting for a decision.</span>
          <span className="muted" style={{ fontSize: 14 }}>
            When a bonus or other deposit shows up, it lands here first.
          </span>
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
                    {fmtShort(e.receivedOn)} · {e.allocation ? LABEL[e.allocation.kind] : ''}
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
