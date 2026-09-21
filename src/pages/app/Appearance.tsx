import { Link, useNavigate } from 'react-router-dom';
import { Icon, type IconName } from '../../components/Icon';
import { OptionCard } from '../../components/OptionCard';
import type { ThemeChoice } from '../../domain/types';
import { fmt } from '../../lib/money';
import { useStore } from '../../state/store';
import { useTheme } from '../../state/theme';

const OPTIONS: { value: ThemeChoice; title: string; sub?: string; icon: IconName }[] = [
  { value: 'system', title: 'Match my device', sub: 'Follows your system setting.', icon: 'phone' },
  { value: 'light', title: 'Light', icon: 'sun' },
  { value: 'dark', title: 'Dark', icon: 'moon' },
];

export function Appearance() {
  const { choice, setChoice } = useTheme();
  const { reset } = useStore();
  const navigate = useNavigate();

  return (
    <main className="shell-main stack" style={{ gap: 18, maxWidth: 640 }}>
      <div className="page-head stack" style={{ gap: 6 }}>
        <span className="eyebrow">Settings</span>
        <h1>Appearance</h1>
        <p className="muted" style={{ fontSize: 15 }}>
          Pick whatever is easiest on your eyes. Dark is handy for late-night check-ins.
        </p>
      </div>

      <div className="card stack">
        <span className="eyebrow">Preview</span>
        <div className="hero" style={{ padding: 16, borderRadius: 14 }}>
          <span className="eyebrow" style={{ fontSize: 12 }}>
            This paycheck
          </span>
          <span className="display" style={{ fontSize: 30 }}>
            {fmt(2140)}
          </span>
        </div>
        <div className="bucket" style={{ background: 'var(--bg)' }}>
          <div className="between" style={{ alignItems: 'baseline' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Groceries</span>
            <span className="muted small">
              <b style={{ color: 'var(--ink)' }}>{fmt(84)}</b> of {fmt(260)}
            </span>
          </div>
          <div className="bar">
            <div style={{ width: '32%' }} />
          </div>
        </div>
      </div>

      <div className="stack">
        {OPTIONS.map((o) => (
          <OptionCard key={o.value} selected={choice === o.value} onSelect={() => setChoice(o.value)} title={o.title} sub={o.sub} icon={o.icon} />
        ))}
      </div>

      <div className="list-card">
        <Link to="/setup/pay" className="list-row between">
          <span style={{ fontWeight: 700, fontSize: 15 }}>Paydays &amp; income</span>
          <span className="muted">
            <Icon name="chevronRight" />
          </span>
        </Link>
        <Link to="/app/buckets" className="list-row between">
          <span style={{ fontWeight: 700, fontSize: 15 }}>Buckets</span>
          <span className="muted">
            <Icon name="chevronRight" />
          </span>
        </Link>
        <button
          type="button"
          className="list-row between"
          style={{ background: 'none', border: 0, cursor: 'pointer', width: '100%', borderTop: '1px solid var(--divider)' }}
          onClick={() => {
            if (window.confirm('Start over? This clears your answers, buckets and purchases on this device.')) {
              reset();
              navigate('/');
            }
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--clay)' }}>Start over</span>
          <span className="small muted">Clears everything on this device</span>
        </button>
      </div>

      <span className="small muted" style={{ textAlign: 'center' }}>
        Changes apply right away, everywhere in the app.
      </span>
    </main>
  );
}
