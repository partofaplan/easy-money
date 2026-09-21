import type { Bucket } from '../domain/types';
import { fmt } from '../lib/money';

export function BucketRow({ bucket }: { bucket: Bucket }) {
  const pct = bucket.planned > 0 ? Math.min(100, (bucket.spent / bucket.planned) * 100) : 0;
  const over = bucket.spent > bucket.planned;
  const label = bucket.kind === 'savings' ? 'moved' : `of ${fmt(bucket.planned)}`;
  return (
    <div className="bucket">
      <div className="between" style={{ alignItems: 'baseline' }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{bucket.name}</span>
        <span className="muted" style={{ fontSize: 14 }}>
          <b style={{ color: over ? 'var(--clay)' : 'var(--ink)' }}>{fmt(bucket.spent)}</b> {label}
        </span>
      </div>
      <div className={`bar ${over ? 'over' : ''}`}>
        <div style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
