import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon, type IconName } from '../../components/Icon';
import { OptionCard } from '../../components/OptionCard';
import type { ThemeChoice } from '../../domain/types';
import { fmt } from '../../lib/money';
import { FREQUENCY_LABEL } from '../../domain/plan';
import { useAuth } from '../../cloud/AuthProvider';
import { useProfiles } from '../../state/profileContext';
import { useStore } from '../../state/store';
import { useTheme } from '../../state/theme';

const OPTIONS: { value: ThemeChoice; title: string; sub?: string; icon: IconName }[] = [
  { value: 'system', title: 'Match my device', sub: 'Follows your system setting.', icon: 'phone' },
  { value: 'light', title: 'Light', icon: 'sun' },
  { value: 'dark', title: 'Dark', icon: 'moon' },
];

export function Settings() {
  const { choice, setChoice } = useTheme();
  const { data, reset } = useStore();
  const a = data.answers;
  const paySummary =
    a.payType === 'hourly'
      ? `By the hour, ${fmt(a.hourlyRate ?? 0)}/hr, ${a.typicalHours ?? 0} hours typical`
      : `A set amount, ${fmt(a.paycheckAmount ?? 0)} take-home`;
  const { active, profiles, rename, remove } = useProfiles();
  const auth = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(active?.name ?? '');

  return (
    <main className="shell-main stack" style={{ gap: 18, maxWidth: 640 }}>
      <div className="page-head stack" style={{ gap: 6 }}>
        <h1>Settings</h1>
        <p className="muted" style={{ fontSize: 15 }}>
          Everything here belongs to {active?.name ?? 'this profile'}. Other profiles on this device keep their own.
        </p>
      </div>

      {auth.status === 'signedIn' && auth.user && (
        <section className="card between" aria-labelledby="account-heading" style={{ flexWrap: 'wrap' }}>
          <span className="stack" style={{ gap: 2 }}>
            <h2 id="account-heading" style={{ fontSize: 20 }}>
              Account
            </h2>
            <span className="small muted">Signed in as {auth.user.email}. Your profiles and budgets are saved to this account.</span>
          </span>
          <button type="button" className="btn btn-outline btn-sm" style={{ minHeight: 44 }} onClick={() => void auth.signOut()}>
            Sign out
          </button>
        </section>
      )}

      <section className="card stack" aria-labelledby="profile-heading">
        <h2 id="profile-heading" style={{ fontSize: 20 }}>
          Profile
        </h2>
        <form
          className="row"
          style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}
          onSubmit={(e) => {
            e.preventDefault();
            if (active && name.trim()) rename(active.id, name);
          }}
        >
          <div className="field grow">
            <label htmlFor="profile-name">Name</label>
            <div className="input">
              <input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="btn btn-outline" style={{ minHeight: 48 }} disabled={!name.trim() || name.trim() === active?.name}>
            Rename
          </button>
        </form>
        <div className="list-card">
          <Link to="/profiles" className="list-row between">
            <span className="stack" style={{ gap: 2 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Switch profile</span>
              <span className="small muted">{profiles.length === 1 ? 'Only you so far.' : `${profiles.length} profiles on this device.`}</span>
            </span>
            <span className="muted">
              <Icon name="chevronRight" />
            </span>
          </Link>
          <Link to="/profiles?add=1" className="list-row between">
            <span style={{ fontWeight: 700, fontSize: 15 }}>Add a profile</span>
            <span className="muted">
              <Icon name="plus" />
            </span>
          </Link>
        </div>
      </section>

      <section className="stack" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading" style={{ fontSize: 20 }}>
          Appearance
        </h2>
        <p className="muted" style={{ fontSize: 15 }}>
          Pick whatever is easiest on your eyes. Dark is handy for late-night check-ins.
        </p>
      </section>

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
        <Link to="/setup/estimate" className="list-row between">
          <span className="stack" style={{ gap: 2 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Pay &amp; taxes</span>
            <span className="small muted">
              {paySummary}, paid {a.payFrequency ? FREQUENCY_LABEL[a.payFrequency] : ''}.
            </span>
          </span>
          <span className="muted">
            <Icon name="chevronRight" />
          </span>
        </Link>
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
            if (window.confirm(`Start over? This clears ${active?.name ?? 'this profile'}'s answers, buckets and purchases.`)) {
              reset();
              navigate('/');
            }
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--clay)' }}>Start over</span>
          <span className="small muted">Clears this profile&rsquo;s budget</span>
        </button>
        <button
          type="button"
          className="list-row between"
          style={{ background: 'none', border: 0, cursor: 'pointer', width: '100%', borderTop: '1px solid var(--divider)' }}
          onClick={() => {
            if (active && window.confirm(`Delete the profile "${active.name}" and its budget? This cannot be undone.`)) {
              remove(active.id);
              navigate('/profiles');
            }
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--clay)' }}>Delete this profile</span>
          <span className="small muted">Removes it from this device</span>
        </button>
      </div>

      <span className="small muted" style={{ textAlign: 'center' }}>
        Changes apply right away, everywhere in the app.
      </span>
    </main>
  );
}
