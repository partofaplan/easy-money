import { bucketAvailable, type DueStatus } from '../domain/plan';
import type { Bucket } from '../domain/types';
import { fmtShort, today } from '../lib/dates';
import { fmt } from '../lib/money';
import { Icon } from './Icon';

interface DueBadgeProps {
  due: DueStatus;
  /** Called with true to mark the due date paid by hand, false to undo that. */
  onMarkPaid?: (paid: boolean) => void;
  /** Whether the paid state came from the user's own mark rather than spending. */
  markedByHand?: boolean;
}

/** The reminder shown on a bucket whose due date falls in this paycheck. */
export function DueBadge({ due, onMarkPaid, markedByHand }: DueBadgeProps) {
  const past = due.dueOn < today();
  if (due.paid) {
    return (
      <span className="due paid">
        <Icon name="check" size={14} strokeWidth={3} />
        {past ? `Paid, was due ${fmtShort(due.dueOn)}` : `Paid, due ${fmtShort(due.dueOn)}`}
        {markedByHand && onMarkPaid && (
          <button type="button" className="link small" style={{ marginLeft: 6, fontWeight: 600 }} onClick={() => onMarkPaid(false)}>
            Not paid?
          </button>
        )}
      </span>
    );
  }
  return (
    <span className={`due ${due.overdue ? 'overdue' : ''}`} role="status">
      <Icon name="alert" size={14} strokeWidth={2.4} />
      {due.overdue ? `Was due ${fmtShort(due.dueOn)}, don't forget to pay it` : `Due ${fmtShort(due.dueOn)}, don't forget to pay it`}
      {onMarkPaid && (
        <button type="button" className="link small" style={{ marginLeft: 6 }} onClick={() => onMarkPaid(true)}>
          Mark paid
        </button>
      )}
    </span>
  );
}

interface BucketRowProps {
  bucket: Bucket;
  due?: DueStatus | null;
  onMarkPaid?: (paid: boolean) => void;
}

export function BucketRow({ bucket, due, onMarkPaid }: BucketRowProps) {
  // A saving bucket is measured against everything in it, not just this paycheck's share.
  const available = bucketAvailable(bucket);
  // An overspent bucket can owe more than it holds; it has nothing in it, not a negative amount.
  const inIt = Math.max(0, available);
  const pct = inIt > 0 ? Math.min(100, (bucket.spent / inIt) * 100) : 100;
  const over = bucket.spent > available;
  const carried = bucket.savesUp ? (bucket.carried ?? 0) : 0;
  const saved = available - bucket.spent;
  const label = bucket.kind === 'savings' ? 'moved' : `of ${fmt(inIt)}`;
  return (
    <div className={`bucket ${due && !due.paid ? 'bucket-due' : ''}`}>
      <div className="between" style={{ alignItems: 'baseline' }}>
        <span className="row" style={{ gap: 6, fontSize: 15, fontWeight: 700 }}>
          {bucket.name}
          {bucket.savesUp && <span className="chip small">saving up</span>}
        </span>
        <span className="muted" style={{ fontSize: 14 }}>
          <b style={{ color: over ? 'var(--clay)' : 'var(--ink)' }}>{fmt(bucket.spent)}</b> {label}
        </span>
      </div>
      <div className={`bar ${over ? 'over' : ''}`}>
        <div style={{ width: `${pct}%` }} />
      </div>
      {bucket.savesUp && (
        <span className="small muted">
          <b style={{ color: saved < 0 ? 'var(--clay)' : 'var(--ink)' }}>{fmt(Math.abs(saved))}</b> {saved < 0 ? 'overspent' : 'saved so far'} ·{' '}
          {fmt(bucket.planned)} added this paycheck
          {carried > 0 ? `, on top of ${fmt(carried)} carried in` : ''}
          {carried < 0 ? `, less ${fmt(-carried)} overspent last paycheck` : ''}
        </span>
      )}
      {due && <DueBadge due={due} onMarkPaid={onMarkPaid} markedByHand={bucket.paidOn === due.dueOn} />}
    </div>
  );
}
