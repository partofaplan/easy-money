import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Brand } from '../../components/Brand';
import { Icon, type IconName } from '../../components/Icon';
import { useStore } from '../../state/store';
import { fmt } from '../../lib/money';

const ASKS: { icon: IconName; label: string }[] = [
  { icon: 'calendar', label: 'How often you get paid' },
  { icon: 'star', label: 'Bonuses and extra income' },
  { icon: 'arrow', label: 'How far ahead you like to plan' },
  { icon: 'grid', label: 'Where your spending goes' },
];

export function Welcome() {
  const { data, loadDemo } = useStore();
  const navigate = useNavigate();
  if (data.setupComplete) return <Navigate to="/app" replace />;

  const started = data.answers.payFrequency !== null;

  return (
    <div className="welcome">
      <div className="welcome-copy">
        <Brand />
        <h1>Your first budget, built by asking you a few questions.</h1>
        <p className="lead" style={{ marginTop: 16, fontSize: 17 }}>
          No spreadsheets, no jargon. Answer five quick questions and we&rsquo;ll set up a plan that fits how you actually get paid.
        </p>
        <div className="stack" style={{ marginTop: 32 }}>
          <span className="eyebrow">We&rsquo;ll ask about</span>
          <div className="stack" style={{ gap: 8 }}>
            {ASKS.map((a) => (
              <div key={a.label} className="row card" style={{ padding: '12px 14px', gap: 14, borderRadius: 14 }}>
                <span className="iconbox">
                  <Icon name={a.icon} />
                </span>
                <span style={{ fontWeight: 600 }}>{a.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grow" style={{ minHeight: 32 }} />
        <div className="stack">
          <Link to="/setup/pay" className="btn btn-primary">
            {started ? 'Pick up where I left off' : "Let's start"}
          </Link>
          <span className="small muted" style={{ textAlign: 'center' }}>
            Takes about 3 minutes. You can change any answer later.
          </span>
          <button
            type="button"
            className="link"
            style={{ alignSelf: 'center', padding: 8, fontSize: 15 }}
            onClick={() => {
              loadDemo();
              navigate('/app');
            }}
          >
            I&rsquo;ve budgeted before, skip the walkthrough
          </button>
        </div>
      </div>

      <aside className="welcome-preview" aria-label="Example budget">
        <span className="eyebrow">What you&rsquo;ll end up with</span>
        <div className="stack" style={{ width: 440, gap: 12 }}>
          <div className="hero" style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <span className="stack" style={{ gap: 6 }}>
              <span className="eyebrow">This paycheck</span>
              <span className="display amount">{fmt(2140)}</span>
            </span>
            <span className="pill">
              <Icon name="check" size={14} strokeWidth={3} />
              Every dollar has a job
            </span>
          </div>
          {[
            ['Rent & housing', 950, 950],
            ['Groceries', 84, 260],
            ['Eating out & fun', 41, 150],
          ].map(([name, spent, planned]) => (
            <div key={String(name)} className="bucket">
              <div className="between" style={{ alignItems: 'baseline' }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{name}</span>
                <span className="muted" style={{ fontSize: 14 }}>
                  <b style={{ color: 'var(--ink)' }}>{fmt(Number(spent))}</b> of {fmt(Number(planned))}
                </span>
              </div>
              <div className="bar">
                <div style={{ width: `${(Number(spent) / Number(planned)) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <span className="muted" style={{ fontSize: 14 }}>
          A budget that resets every payday, with a job for every dollar.
        </span>
      </aside>
    </div>
  );
}
