import type { DueStatus } from '../domain/plan';
import type { Bucket } from '../domain/types';
import { fmtShort } from '../lib/dates';
import { fmt } from '../lib/money';
import { Icon } from './Icon';

/** The reminder shown on a bucket whose due date falls in this paycheck. */
export function DueBadge({ due }: { due: DueStatus }) {
  if (due.paid) {
    return (
      <span className="due paid">
        <Icon name="check" size={14} strokeWidth={3} />
        Paid, was due {fmtShort(due.dueOn)}
      </span>
    );
  }
  return (
    <span className={`due ${due.overdue ? 'overdue' : ''}`} role="status">
      <Icon name="alert" size={14} strokeWidth={2.4} />
      {due.overdue ? `Was due ${fmtShort(due.dueOn)}, don't forget to pay it` : `Due ${fmtShort(due.dueOn)}, don't forget to pay it`}
    </span>
  );
}

export function BucketRow({ bucket, due }: { bucket: Bucket; due?: DueStatus | null }) {
  const pct = bucket.planned > 0 ? Math.min(100, (bucket.spent / bucket.planned) * 100) : 0;
  const over = bucket.spent > bucket.planned;
  const label = bucket.kind === 'savings' ? 'moved' : `of ${fmt(bucket.planned)}`;
  return (
    <div className={`bucket ${due && !due.paid ? 'bucket-due' : ''}`}>
      <div className="between" style={{ alignItems: 'baseline' }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{bucket.name}</span>
        <span className="muted" style={{ fontSize: 14 }}>
          <b style={{ color: over ? 'var(--clay)' : 'var(--ink)' }}>{fmt(bucket.spent)}</b> {label}
        </span>
      </div>
      <div className={`bar ${over ? 'over' : ''}`}>
        <div style={{ width: `${pct}%` }} />
      </div>
      {due && <DueBadge due={due} />}
    </div>
  );
}
