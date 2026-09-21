import type { DueStatus } from '../domain/plan';
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
      {due && <DueBadge due={due} onMarkPaid={onMarkPaid} markedByHand={bucket.paidOn === due.dueOn} />}
    </div>
  );
}
