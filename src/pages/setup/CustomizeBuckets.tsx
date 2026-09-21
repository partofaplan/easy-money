import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { SetupFrame } from '../../components/SetupFrame';
import { STARTER_BUCKETS } from '../../data/fixtures';
import type { Bucket } from '../../domain/types';
import { newId } from '../../lib/money';
import { useStore } from '../../state/store';

/** Starter buckets with relative weights; real amounts come from the paycheck later. */
function seed(): Bucket[] {
  return STARTER_BUCKETS.map((t) => ({ id: t.id, name: t.name, planned: Math.round(t.share * 1000), defaultAmount: Math.round(t.share * 1000), spent: 0, kind: t.kind }));
}

export function CustomizeBuckets() {
  const { data, setBuckets } = useStore();
  const navigate = useNavigate();
  const [list, setList] = useState<Bucket[]>(() => (data.buckets.length > 0 ? data.buckets : seed()));

  const update = (id: string, name: string) => setList((l) => l.map((b) => (b.id === id ? { ...b, name } : b)));
  const remove = (id: string) => setList((l) => l.filter((b) => b.id !== id));
  const add = () => setList((l) => [...l, { id: newId('bucket'), name: '', planned: 65, defaultAmount: 65, spent: 0, kind: 'spending' }]);
  const valid = list.length > 0 && list.every((b) => b.name.trim().length > 0);

  return (
    <SetupFrame
      step={4}
      backTo="/setup/buckets"
      eyebrow="Question 4"
      title="Name your buckets."
      lead="Rename, remove or add. Keep the list short enough to remember."
      why="You can always come back to this from the Buckets tab. Amounts come next, once we know your paycheck."
      actions={
        <button
          type="button"
          className="btn btn-primary"
          disabled={!valid}
          onClick={() => {
            setBuckets(list.map((b) => ({ ...b, name: b.name.trim() })));
            navigate('/setup/ready');
          }}
        >
          Continue
        </button>
      }
    >
      <div className="stack" style={{ gap: 8 }}>
        {list.map((b, i) => (
          <div key={b.id} className="row card" style={{ padding: '8px 8px 8px 14px' }}>
            <label htmlFor={`bucket-${b.id}`} className="sr-only">
              Bucket {i + 1} name
            </label>
            <input
              id={`bucket-${b.id}`}
              className="grow"
              style={{ border: 0, background: 'transparent', fontWeight: 700, fontSize: 16, minWidth: 0 }}
              value={b.name}
              placeholder="Bucket name"
              onChange={(e) => update(b.id, e.target.value)}
            />
            {b.kind === 'savings' && <span className="chip small">savings</span>}
            <button type="button" className="icon-btn" aria-label={`Remove ${b.name || 'bucket'}`} onClick={() => remove(b.id)}>
              <Icon name="trash" />
            </button>
          </div>
        ))}
        <button type="button" className="bucket-add" onClick={add}>
          <Icon name="plus" size={16} strokeWidth={2.6} />
          Add a bucket
        </button>
      </div>
    </SetupFrame>
  );
}
