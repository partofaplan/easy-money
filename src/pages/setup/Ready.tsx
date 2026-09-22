import { Link, useNavigate } from 'react-router-dom';
import { Icon, type IconName } from '../../components/Icon';
import { MoneyInput } from '../../components/MoneyInput';
import { SetupFrame } from '../../components/SetupFrame';
import { DEFAULT_SEMIMONTHLY, defaultTakeHome, FREQUENCY_LABEL, horizonCount, isHourly } from '../../domain/plan';
import { STATE_TAXES } from '../../data/taxTables';
import { fmtWeekday, ordinalDay } from '../../lib/dates';
import { fmt } from '../../lib/money';
import { starterBucketNames, useStore } from '../../state/store';

export function Ready() {
  const { data, answer, completeSetup } = useStore();
  const navigate = useNavigate();
  const a = data.answers;
  const paycheck = a.paycheckAmount;
  const hourly = a.payType === 'hourly';
  const hourlyNet = isHourly(a) && a.typicalHours ? defaultTakeHome(a) : 0;
  const stateName = STATE_TAXES.find((s) => s.code === a.tax?.stateCode)?.name;
  const taxSummary = a.tax
    ? `${stateName ? `${stateName}, ` : 'federal taxes only, '}${a.tax.filing === 'single' ? 'single' : a.tax.filing === 'married' ? 'married filing jointly' : 'head of household'}${a.tax.retirementPct || a.tax.healthPerPaycheck ? ', with your deductions' : ''}`
    : 'federal taxes only';

  const semi = [...(a.semimonthlyDays ?? DEFAULT_SEMIMONTHLY)].sort((x, y) => x - y);
  const dayName = (d: number) => (d === 31 ? 'the last day' : `the ${ordinalDay(d)}`);
  const freqLabel = a.payFrequency === 'semimonthly' ? `twice a month, on ${dayName(semi[0])} and ${dayName(semi[1])}` : a.payFrequency ? FREQUENCY_LABEL[a.payFrequency] : 'not set';
  const horizonLabel = (() => {
    if (!a.horizon || !a.payFrequency || !a.nextPayday) return 'Not set';
    const n = horizonCount(a.horizon, a.payFrequency, a.nextPayday, a.semimonthlyDays);
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

  const payReady = hourly ? hourlyNet > 0 : paycheck !== null && paycheck > 0;
  const ready = a.payFrequency && a.nextPayday && a.bonuses && a.horizon && a.bucketChoice && payReady;

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
        <span style={{ fontWeight: 700, fontSize: 15 }}>One last thing: how are you paid?</span>
        <div className="seg" role="group" aria-label="Pay type" style={{ alignSelf: 'flex-start' }}>
          <button type="button" aria-pressed={!hourly} onClick={() => answer({ payType: 'salary' })}>
            A set amount
          </button>
          <button type="button" aria-pressed={hourly} onClick={() => answer({ payType: 'hourly' })}>
            By the hour
          </button>
        </div>
        {hourly ? (
          <>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="rate">Pay per hour</label>
                <MoneyInput id="rate" value={a.hourlyRate} onChange={(v) => answer({ hourlyRate: v })} unit="/ hr" />
              </div>
              <div className="field">
                <label htmlFor="hours">Hours in a typical paycheck</label>
                <MoneyInput id="hours" value={a.typicalHours} onChange={(v) => answer({ typicalHours: v })} prefix="" unit="hrs" />
              </div>
            </div>
            <div className="card tint stack" style={{ gap: 4, padding: '12px 14px', borderRadius: 12 }}>
              {hourlyNet > 0 ? (
                <>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>
                    About {fmt(hourlyNet)} take-home for {a.typicalHours} hours
                  </span>
                  <span className="small muted">Estimated with {taxSummary}. Each paycheck&rsquo;s plan can use different hours.</span>
                </>
              ) : (
                <span className="small muted">Enter your rate and hours to see the take-home estimate.</span>
              )}
            </div>
          </>
        ) : (
          <>
            <label htmlFor="paycheck" className="small" style={{ fontWeight: 700 }}>
              How much is a typical paycheck, after taxes?
            </label>
            <MoneyInput id="paycheck" value={paycheck} onChange={(v) => answer({ paycheckAmount: v })} big />
            <span className="small muted">A rough number is fine. We&rsquo;ll fill in buckets from it and you can adjust.</span>
          </>
        )}
        <Link to="/setup/estimate" className="between card tint" style={{ padding: '12px 14px', borderRadius: 12, textDecoration: 'none', color: 'var(--ink)' }}>
          <span className="stack" style={{ gap: 2 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{hourly ? 'Adjust taxes and deductions' : 'Not sure? Estimate it from your salary'}</span>
            <span className="small muted" style={{ fontSize: 12 }}>
              {hourly ? 'Your state, filing status, retirement and health premiums make the estimate closer.' : "We'll factor in taxes and deductions. Use it or not, your call."}
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
