import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { Icon } from '../components/Icon';
import { useAuth } from '../cloud/AuthProvider';
import { useProfiles } from '../state/profileContext';

/** Pick who is budgeting, or add someone. Each profile keeps its own budget and settings. */
export function ProfilesPage() {
  const { profiles, active, create, switchTo } = useProfiles();
  const auth = useAuth();
  const signedIn = auth.status === 'signedIn' && auth.user;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [adding, setAdding] = useState(profiles.length === 0 || params.get('add') === '1');
  const [name, setName] = useState('');
  const duplicate = profiles.some((p) => p.name.toLowerCase() === name.trim().toLowerCase());

  const submit = () => {
    if (!name.trim() || duplicate) return;
    create(name);
    setName('');
    setAdding(false);
    navigate('/');
  };

  return (
    <div className="welcome">
      <div className="welcome-copy" style={{ maxWidth: 560 }}>
        <Brand />
        <h1 style={{ marginTop: 44 }}>{profiles.length === 0 ? 'Who’s budgeting?' : 'Choose a profile'}</h1>
        <p className="lead" style={{ marginTop: 12 }}>
          {profiles.length === 0
            ? signedIn
              ? 'Add a name to start. A profile is one budget; you can keep more than one in your account.'
              : 'Add a name to start. Everyone who shares this device can have their own budget and settings.'
            : 'Each profile keeps its own budget, plan and settings.'}
        </p>

        {profiles.length > 0 && (
          <div className="stack" style={{ marginTop: 28, gap: 8 }}>
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                className="option"
                aria-pressed={p.id === active?.id}
                onClick={() => {
                  switchTo(p.id);
                  navigate('/');
                }}
              >
                <span className="iconbox" aria-hidden="true">
                  <span style={{ fontWeight: 700 }}>{p.name.slice(0, 1).toUpperCase()}</span>
                </span>
                <span className="stack grow" style={{ gap: 2 }}>
                  <span className="title">{p.name}</span>
                  {p.id === active?.id && <span className="sub">Currently open</span>}
                </span>
                <Icon name="chevronRight" size={20} strokeWidth={2.4} />
              </button>
            ))}
          </div>
        )}

        {adding ? (
          <form
            className="card stack"
            style={{ marginTop: 16 }}
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="field">
              <label htmlFor="profile-name">Name</label>
              <div className="input">
                <input id="profile-name" value={name} autoFocus placeholder="Your first name" onChange={(e) => setName(e.target.value)} />
              </div>
            </div>
            {duplicate && (
              <span className="small" style={{ color: 'var(--warn-text)', fontWeight: 700 }}>
                There is already a profile called {name.trim()}. Pick another name.
              </span>
            )}
            <div className="row">
              <button type="submit" className="btn btn-primary" style={{ minHeight: 48 }} disabled={!name.trim() || duplicate}>
                {profiles.length === 0 ? "Let's go" : 'Add profile'}
              </button>
              {profiles.length > 0 && (
                <button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        ) : (
          <button type="button" className="bucket-add" style={{ marginTop: 16 }} onClick={() => setAdding(true)}>
            <Icon name="plus" size={16} strokeWidth={2.6} />
            Add a profile
          </button>
        )}

        <span className="small muted" style={{ marginTop: 24 }}>
          {signedIn ? (
            <>
              Saved to {auth.user?.email}.{' '}
              <button type="button" className="link small" onClick={() => void auth.signOut()}>
                Sign out
              </button>
            </>
          ) : (
            'Profiles live on this device only. Nothing is sent anywhere.'
          )}
        </span>
      </div>
    </div>
  );
}
