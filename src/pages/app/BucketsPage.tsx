import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { MoneyInput } from '../../components/MoneyInput';
import type { Bucket } from '../../domain/types';
import { extraTotalForPayday } from '../../domain/plan';
import { fmt, newId } from '../../lib/money';
import { useCurrentPayday } from '../../state/selectors';
import { useStore } from '../../state/store';

export function BucketsPage() {
  const { data, setBuckets } = useStore();
  const [list, setList] = useState<Bucket[]>(data.buckets);
  const [saved, setSaved] = useState(false);

  const currentPayday = useCurrentPayday();
  const paycheck = (data.answers.paycheckAmount ?? 0) + extraTotalForPayday(data.incomeEvents, currentPayday);
  const planned = list.reduce((s, b) => s + b.planned, 0);
  const left = paycheck - planned;
  const dirty = JSON.stringify(list) !== JSON.stringify(data.buckets);

  const patch = (id: string, p: Partial<Bucket>) => {
    setSaved(false);
    setList((l) => l.map((b) => (b.id === id ? { ...b, ...p } : b)));
  };

  return (
    <main className="shell-main stack" style={{ gap: 18 }}>
      <div className="page-head between" style={{ alignItems: 'flex-end' }}>
        <span className="stack" style={{ gap: 6 }}>
          <h1>Buckets</h1>
          <p className="muted" style={{ fontSize: 15 }}>
            How the {fmt(paycheck)} in this paycheck is split up.
          </p>
        </span>
        <span className={`pill`} style={{ background: left === 0 ? 'var(--tint)' : 'var(--warn-bg)', color: left === 0 ? 'var(--accent)' : 'var(--warn-text)' }}>
          {left === 0 ? 'Every dollar has a job' : left > 0 ? `${fmt(left)} left to assign` : `${fmt(-left)} over`}
        </span>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        {list.map((b, i) => (
          <div key={b.id} className="card row" style={{ padding: '10px 10px 10px 14px', flexWrap: 'wrap' }}>
            <label htmlFor={`name-${b.id}`} className="sr-only">
              Bucket {i + 1} name
            </label>
            <input
              id={`name-${b.id}`}
              className="grow"
              style={{ border: 0, background: 'transparent', fontWeight: 700, fontSize: 16, minWidth: 140 }}
              value={b.name}
              onChange={(e) => patch(b.id, { name: e.target.value })}
            />
            <label htmlFor={`planned-${b.id}`} className="sr-only">
              Planned for {b.name}
            </label>
            <div style={{ width: 140 }}>
              <MoneyInput key={`${b.id}-${data.buckets.length}`} id={`planned-${b.id}`} value={b.planned} onChange={(v) => patch(b.id, { planned: v ?? 0 })} />
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Remove ${b.name}`}
              onClick={() => {
                setSaved(false);
                setList((l) => l.filter((x) => x.id !== b.id));
              }}
            >
              <Icon name="trash" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="bucket-add"
          onClick={() => {
            setSaved(false);
            setList((l) => [...l, { id: newId('bucket'), name: 'New bucket', planned: Math.max(0, left), spent: 0, kind: 'spending' }]);
          }}
        >
          <Icon name="plus" size={16} strokeWidth={2.6} />
          Add a bucket
        </button>
      </div>

      <div className="row">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!dirty || list.some((b) => !b.name.trim())}
          onClick={() => {
            setBuckets(list.map((b) => ({ ...b, name: b.name.trim() })));
            setSaved(true);
          }}
        >
          Save changes
        </button>
        {saved && <span className="small muted">Saved.</span>}
      </div>
    </main>
  );
}
