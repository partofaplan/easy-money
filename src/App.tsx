import React, { useCallback, useMemo } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { StoreProvider, useStore } from './state/store';
import { ThemeProvider } from './state/theme';
import { ProfileProvider, useProfiles } from './state/profileContext';
import { AuthProvider, useAuth, type AuthUser } from './cloud/AuthProvider';
import { cloudEnabled } from './cloud/firebase';
import { FirestoreProfileStore, FirestoreRepository } from './cloud/firestoreStores';
import { SignInPage } from './pages/SignInPage';
import { ProfileRegistry } from './state/profiles';
import { LocalStorageRepository } from './state/repository';
import { dataKey } from './state/profiles';
import { ProfilesPage } from './pages/ProfilesPage';
import { Welcome } from './pages/setup/Welcome';
import { PayFrequency } from './pages/setup/PayFrequency';
import { Bonuses } from './pages/setup/Bonuses';
import { PlanAhead } from './pages/setup/PlanAhead';
import { Buckets } from './pages/setup/Buckets';
import { CustomizeBuckets } from './pages/setup/CustomizeBuckets';
import { LifestyleBuckets } from './pages/setup/LifestyleBuckets';
import { Ready } from './pages/setup/Ready';
import { Estimate } from './pages/setup/Estimate';
import { Home } from './pages/app/Home';
import { Ahead } from './pages/app/Ahead';
import { PlanPage } from './pages/app/PlanPage';
import { ExtraMoney } from './pages/app/ExtraMoney';
import { BucketsPage } from './pages/app/BucketsPage';
import { Settings } from './pages/app/Settings';

function RequireSetup({ children }: { children: JSX.Element }) {
  const { data } = useStore();
  return data.setupComplete ? children : <Navigate to="/" replace />;
}

/** Screens with nobody open (sign-in, profile picker) follow the device setting. */
function NeutralTheme({ children }: { children: React.ReactNode }) {
  const noop = useCallback(() => undefined, []);
  return (
    <ThemeProvider choice="system" onChange={noop}>
      {children}
    </ThemeProvider>
  );
}

function Splash({ text }: { text: string }) {
  return (
    <div className="welcome">
      <div className="welcome-copy" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <span className="muted">{text}</span>
      </div>
    </div>
  );
}

/**
 * Cloud mode: sign in first, then that account's profiles. Local mode: device
 * profiles straight away. Either way the app below sees the same providers.
 */
export function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

function AuthGate() {
  const { status, user } = useAuth();
  if (status === 'loading') return <Splash text="Signing you in…" />;
  if (status === 'signedOut') {
    return (
      <NeutralTheme>
        <Routes>
          <Route path="*" element={<SignInPage />} />
        </Routes>
      </NeutralTheme>
    );
  }
  return <ProfilesForAccount user={status === 'signedIn' ? user : null} />;
}

const localProfiles = new ProfileRegistry();

function ProfilesForAccount({ user }: { user: AuthUser | null }) {
  const uid = user?.uid ?? null;
  const email = user?.email ?? '';
  const store = useMemo(() => (uid ? new FirestoreProfileStore(uid, email) : localProfiles), [uid, email]);
  return (
    <ProfileProvider key={user?.uid ?? 'local'} store={store}>
      <BudgetForProfile user={user} />
    </ProfileProvider>
  );
}

function BudgetForProfile({ user }: { user: AuthUser | null }) {
  const { ready, error, retry, active, setTheme } = useProfiles();
  const activeId = active?.id ?? null;
  const uid = user?.uid ?? null;
  const repository = useMemo(() => {
    if (!activeId) return null;
    return uid ? new FirestoreRepository(uid, activeId) : new LocalStorageRepository(dataKey(activeId));
  }, [uid, activeId]);
  const scope = uid ? `${uid}.` : '';
  const onTheme = useCallback((c: 'system' | 'light' | 'dark') => activeId && setTheme(activeId, c), [activeId, setTheme]);

  if (!ready) {
    if (error) {
      return (
        <div className="welcome">
          <div className="welcome-copy stack" style={{ justifyContent: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 26 }}>Couldn&rsquo;t load your profiles.</h1>
            <p className="muted">{error}</p>
            <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={retry}>
              Try again
            </button>
          </div>
        </div>
      );
    }
    return <Splash text="Loading your profiles\u2026" />;
  }

  if (!active || !repository) {
    return (
      <NeutralTheme>
        <Routes>
          <Route path="*" element={<ProfilesPage />} />
        </Routes>
      </NeutralTheme>
    );
  }

  // The store is keyed by profile so switching remounts it with that profile's
  // data. The theme comes from the profile record, so it travels with the account.
  return (
    <ThemeProvider choice={active.theme ?? 'system'} onChange={onTheme}>
      <StoreProvider key={`store-${scope}${active.id}`} repository={repository} fallback={<Splash text="Opening your budget…" />}>
        <AppRoutes />
      </StoreProvider>
    </ThemeProvider>
  );
}

export { cloudEnabled };

function AppRoutes() {
  return (
    <Routes>
      <Route path="/profiles" element={<ProfilesPage />} />
      <Route path="/" element={<Welcome />} />
      <Route path="/setup/pay" element={<PayFrequency />} />
      <Route path="/setup/bonuses" element={<Bonuses />} />
      <Route path="/setup/ahead" element={<PlanAhead />} />
      <Route path="/setup/buckets" element={<Buckets />} />
      <Route path="/setup/buckets/lifestyle" element={<LifestyleBuckets />} />
      <Route path="/setup/buckets/customize" element={<CustomizeBuckets />} />
      <Route path="/setup/ready" element={<Ready />} />
      <Route path="/setup/estimate" element={<Estimate />} />
      <Route
        path="/app"
        element={
          <RequireSetup>
            <AppShell />
          </RequireSetup>
        }
      >
        <Route index element={<Home />} />
        <Route path="plan" element={<PlanPage />} />
        <Route path="ahead" element={<Ahead />} />
        <Route path="extra" element={<ExtraMoney />} />
        <Route path="buckets" element={<BucketsPage />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
