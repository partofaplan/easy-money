import { Link, useNavigate } from 'react-router-dom';
import { Icon, type IconName } from '../../components/Icon';
import { MoneyInput } from '../../components/MoneyInput';
import { SetupFrame } from '../../components/SetupFrame';
import { FREQUENCY_LABEL, horizonCount } from '../../domain/plan';
import { fmtWeekday } from '../../lib/dates';
import { starterBucketNames, useStore } from '../../state/store';

export function Ready() {
  const { data, answer, completeSetup } = useStore();
  const navigate = useNavigate();
  const a = data.answers;
  const paycheck = a.paycheckAmount;

  const freqLabel = a.payFrequency ? FREQUENCY_LABEL[a.payFrequency] : 'not set';
  const horizonLabel = (() => {
    if (!a.horizon || !a.payFrequency || !a.nextPayday) return 'Not set';
    const n = horizonCount(a.horizon, a.payFrequency, a.nextPayday);
    return n === 1 ? 'One paycheck at a time' : `Planning ${n} paychecks ahead`;
  })();
  const bucketNames = data.buckets.length > 0 ? data.buckets.map((b) => b.name) : starterBucketNames;

  const rows: { icon: IconName; title: string; sub: string; to: string }[] = [
    {
      icon: 'calendar',
      title: `Paid ${freqLabel}`,
      sub: a.nextPayday ? `Next payday ${fmtWeekday(a.nextPayday)}. Budget resets each payday.` : 'Add your next payday.',
      to: '/setup/pay',
    },
    {
      icon: 'star',
      title: a.bonuses === 'none' ? 'No extra money expected' : 'Bonuses kept separate',
      sub: a.bonuses === 'none' ? 'You can still add extra money later.' : "We'll ask where each one goes when it lands.",
      to: '/setup/bonuses',
    },
    {
      icon: 'arrow',
      title: horizonLabel,
      sub: a.horizon === 'this' ? 'The Ahead view stays out of your way.' : 'Bills show up in the paycheck that covers them.',
      to: '/setup/ahead',
    },
    {
      icon: 'grid',
      title: `${bucketNames.length} ${a.bucketChoice === 'custom' ? 'custom' : 'starter'} buckets`,
      sub: bucketNames.join(', ') + '.',
      to: a.bucketChoice === 'custom' ? '/setup/buckets/customize' : '/setup/buckets',
    },
  ];

  const ready = a.payFrequency && a.nextPayday && a.bonuses && a.horizon && a.bucketChoice && paycheck !== null && paycheck > 0;

  return (
    <SetupFrame
      step={5}
      backTo="/setup/buckets"
      eyebrow="All set"
      title="Here's the plan we set up for you."
      lead="Tap any line to change it. Nothing here is locked in."
      why="A rough paycheck number is fine to start. The buckets scale to it, and you can fix the number the first time a real paycheck arrives."
      actions={
        <button
          type="button"
          className="btn btn-primary"
          disabled={!ready}
          onClick={() => {
            completeSetup();
            navigate('/app');
          }}
        >
          Open my budget
        </button>
      }
    >
      <div className="list-card">
        {rows.map((r) => (
          <Link key={r.title} to={r.to} className="list-row">
            <span className="iconbox">
              <Icon name={r.icon} />
            </span>
            <span className="stack grow" style={{ gap: 2 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{r.title}</span>
              <span className="small muted">{r.sub}</span>
            </span>
            <span className="link small">Change</span>
          </Link>
        ))}
      </div>

      <div className="card stack" style={{ marginTop: 6 }}>
        <label htmlFor="paycheck" style={{ fontWeight: 700, fontSize: 15 }}>
          One last thing: how much is a typical paycheck, after taxes?
        </label>
        <MoneyInput id="paycheck" value={paycheck} onChange={(v) => answer({ paycheckAmount: v })} big />
        <span className="small muted">A rough number is fine. We&rsquo;ll fill in buckets from it and you can adjust.</span>
        <Link to="/setup/estimate" className="between card tint" style={{ padding: '12px 14px', borderRadius: 12, textDecoration: 'none', color: 'var(--ink)' }}>
          <span className="stack" style={{ gap: 2 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Not sure? Estimate it from your salary</span>
            <span className="small muted" style={{ fontSize: 12 }}>
              We&rsquo;ll factor in taxes and deductions. Use it or not, your call.
            </span>
          </span>
          <span style={{ color: 'var(--accent)', display: 'inline-flex' }}>
            <Icon name="chevronRight" size={20} strokeWidth={2.4} />
          </span>
        </Link>
      </div>
    </SetupFrame>
  );
}
