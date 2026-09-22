import { useMemo } from 'react';
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
import { dataKey, themeKey } from './state/profiles';
import { ProfilesPage } from './pages/ProfilesPage';
import { Welcome } from './pages/setup/Welcome';
import { PayFrequency } from './pages/setup/PayFrequency';
import { Bonuses } from './pages/setup/Bonuses';
import { PlanAhead } from './pages/setup/PlanAhead';
import { Buckets } from './pages/setup/Buckets';
import { CustomizeBuckets } from './pages/setup/CustomizeBuckets';
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
      <ThemeProvider storageKey="easy-money.theme.signin">
        <Routes>
          <Route path="*" element={<SignInPage />} />
        </Routes>
      </ThemeProvider>
    );
  }
  return <ProfilesForAccount user={status === 'signedIn' ? user : null} />;
}

const localProfiles = new ProfileRegistry();

function ProfilesForAccount({ user }: { user: AuthUser | null }) {
  const store = useMemo(() => (user ? new FirestoreProfileStore(user.uid, user.email) : localProfiles), [user]);
  return (
    <ProfileProvider key={user?.uid ?? 'local'} store={store}>
      <BudgetForProfile user={user} />
    </ProfileProvider>
  );
}

function BudgetForProfile({ user }: { user: AuthUser | null }) {
  const { ready, active } = useProfiles();
  const activeId = active?.id ?? null;
  const repository = useMemo(() => {
    if (!activeId) return null;
    return user ? new FirestoreRepository(user.uid, activeId) : new LocalStorageRepository(dataKey(activeId));
  }, [user, activeId]);
  const scope = user ? `${user.uid}.` : '';

  if (!ready) return <Splash text="Loading your profiles…" />;

  if (!active || !repository) {
    return (
      <ThemeProvider storageKey="easy-money.theme">
        <Routes>
          <Route path="*" element={<ProfilesPage />} />
        </Routes>
      </ThemeProvider>
    );
  }

  // Both providers are keyed by profile so switching remounts them with that
  // profile's data; neither relies on the other for isolation.
  return (
    <ThemeProvider key={`theme-${scope}${active.id}`} storageKey={themeKey(`${scope}${active.id}`)}>
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
