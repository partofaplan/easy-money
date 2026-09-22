import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { cloudEnabled, firebaseAuth } from './firebase';

export interface AuthUser {
  uid: string;
  email: string;
}

interface AuthCtx {
  /** 'local' when the build has no Firebase config; then nobody signs in. */
  status: 'local' | 'loading' | 'signedOut' | 'signedIn';
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthCtx['status']>(cloudEnabled ? 'loading' : 'local');
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (!cloudEnabled) return;
    return onAuthStateChanged(firebaseAuth(), (u) => {
      if (u && u.email) {
        setUser({ uid: u.uid, email: u.email });
        setStatus('signedIn');
      } else {
        setUser(null);
        setStatus('signedOut');
      }
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(firebaseAuth(), email.trim(), password);
  }, []);
  const signUp = useCallback(async (email: string, password: string) => {
    await createUserWithEmailAndPassword(firebaseAuth(), email.trim(), password);
  }, []);
  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(firebaseAuth(), email.trim());
  }, []);
  const signOut = useCallback(async () => {
    await firebaseSignOut(firebaseAuth());
  }, []);

  const value = useMemo<AuthCtx>(() => ({ status, user, signIn, signUp, resetPassword, signOut }), [status, user, signIn, signUp, resetPassword, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Plain-English text for the sign-in errors people actually hit. */
export function describeAuthError(err: unknown): string {
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: string }).code) : '';
  switch (code) {
    case 'auth/invalid-email':
      return 'That doesn’t look like an email address.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email or password didn’t match. Check both, or reset your password.';
    case 'auth/email-already-in-use':
      return 'There’s already an account for that email. Sign in instead.';
    case 'auth/weak-password':
      return 'Use a password of at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many tries. Wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Couldn’t reach the sign-in service. Check your connection.';
    default:
      return 'Something went wrong signing in. Please try again.';
  }
}
