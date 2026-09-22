import { useState } from 'react';
import { Brand } from '../components/Brand';
import { describeAuthError, useAuth } from '../cloud/AuthProvider';

type Mode = 'signIn' | 'signUp' | 'reset';

/** Email and password sign-in. Accounts are the boundary for everyone's data. */
export function SignInPage() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setNotice(null);
  };

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('That doesn\u2019t look like an email address.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signIn') await signIn(email, password);
      else if (mode === 'signUp') await signUp(email, password);
      else {
        await resetPassword(email);
        setNotice(`If there’s an account for ${email.trim()}, a reset link is on its way.`);
        setMode('signIn');
      }
    } catch (e) {
      setError(describeAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'signIn' ? 'Sign in to your budget.' : mode === 'signUp' ? 'Create your account.' : 'Reset your password.';
  const lead =
    mode === 'signIn'
      ? 'Sign in with your email to open your budget on any device.'
      : mode === 'signUp'
        ? 'Your budget, plans and settings are saved to your account, not this device.'
        : 'We’ll email you a link to choose a new password.';

  return (
    <div className="welcome">
      <div className="welcome-copy" style={{ maxWidth: 560 }}>
        <Brand />
        <h1 style={{ marginTop: 44 }}>{title}</h1>
        <p className="lead" style={{ marginTop: 12 }}>
          {lead}
        </p>

        <form
          className="card stack"
          style={{ marginTop: 28 }}
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="field">
            <label htmlFor="email">Email</label>
            <div className="input">
              <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          {mode !== 'reset' && (
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="input">
                <input
                  id="password"
                  type="password"
                  autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {mode === 'signUp' && <span className="small muted">At least 8 characters.</span>}
            </div>
          )}
          {error && (
            <span className="small" role="alert" style={{ color: 'var(--clay)', fontWeight: 700 }}>
              {error}
            </span>
          )}
          {notice && (
            <span className="small" role="status" style={{ color: 'var(--accent)', fontWeight: 700 }}>
              {notice}
            </span>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy || !email.trim() || (mode !== 'reset' && password.length < (mode === 'signUp' ? 8 : 6))}>
            {busy ? 'One moment…' : mode === 'signIn' ? 'Sign in' : mode === 'signUp' ? 'Create account' : 'Send reset link'}
          </button>
        </form>

        <div className="stack" style={{ marginTop: 16, gap: 8, alignItems: 'center' }}>
          {mode === 'signIn' && (
            <>
              <button type="button" className="link" onClick={() => switchMode('signUp')}>
                New here? Create an account
              </button>
              <button type="button" className="link small" onClick={() => switchMode('reset')}>
                Forgot your password?
              </button>
            </>
          )}
          {mode !== 'signIn' && (
            <button type="button" className="link" onClick={() => switchMode('signIn')}>
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
