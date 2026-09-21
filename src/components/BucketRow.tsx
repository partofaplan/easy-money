import { hasMonthlyTarget, type DueStatus, type FundingStep } from '../domain/plan';
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
  /** This paycheck's step toward a monthly target, for envelopes that have one. */
  funding?: FundingStep | null;
  onMarkPaid?: (paid: boolean) => void;
}

export function BucketRow({ bucket, due, funding, onMarkPaid }: BucketRowProps) {
  const monthly = hasMonthlyTarget(bucket) && funding ? { target: bucket.monthlyTarget, step: funding } : null;
  const over = bucket.spent > (monthly ? monthly.target : bucket.planned);
  const paidOut = !!due?.paid;

  // An envelope saving for a monthly bill fills toward the bill; other buckets fill as they are spent.
  const pct = monthly
    ? paidOut
      ? 100
      : Math.min(100, (monthly.step.ready / monthly.target) * 100)
    : bucket.planned > 0
      ? Math.min(100, (bucket.spent / bucket.planned) * 100)
      : 0;
  const partlyPaid = monthly && !paidOut && bucket.spent > 0 && monthly.step.dueOn !== null;
  const surplus = monthly && !paidOut ? monthly.step.ready - monthly.target : 0;
  const amountLabel = monthly ? (
    paidOut ? (
      <>
        <b>{fmt(monthly.target)}</b> paid
      </>
    ) : partlyPaid ? (
      <>
        <b>{fmt(bucket.spent)}</b> paid, {fmt(monthly.target - bucket.spent)} to go
      </>
    ) : (
      <>
        <b>{fmt(monthly.step.ready)}</b> ready of {fmt(monthly.target)}
      </>
    )
  ) : (
    <>
      <b style={{ color: over ? 'var(--clay)' : 'var(--ink)' }}>{fmt(bucket.spent)}</b> {bucket.kind === 'savings' ? 'moved' : `of ${fmt(bucket.planned)}`}
    </>
  );

  return (
    <div className={`bucket ${due && !due.paid ? 'bucket-due' : ''}`}>
      <div className="between" style={{ alignItems: 'baseline' }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{bucket.name}</span>
        <span className="muted" style={{ fontSize: 14 }}>
          {amountLabel}
        </span>
      </div>
      <div className={`bar ${over ? 'over' : ''}`}>
        <div style={{ width: `${pct}%` }} />
      </div>
      {monthly && !paidOut && (
        <span className="small muted">
          {fmt(bucket.balance ?? 0)} saved earlier + {fmt(bucket.planned)} this paycheck
          {monthly.step.short > 0 && monthly.step.dueOn && (
            <span style={{ color: 'var(--warn-text)', fontWeight: 700 }}>
              {' '}
              · short {fmt(monthly.step.short)} for {fmtShort(monthly.step.dueOn)}
            </span>
          )}
          {surplus > 0 && <span> · {fmt(surplus)} more than the bill needs</span>}
        </span>
      )}
      {due && <DueBadge due={due} onMarkPaid={onMarkPaid} markedByHand={bucket.paidOn === due.dueOn} />}
    </div>
  );
}
