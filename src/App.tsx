import { useMemo } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { StoreProvider, useStore } from './state/store';
import { ThemeProvider } from './state/theme';
import { useProfiles } from './state/profileContext';
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

export function App() {
  const { active } = useProfiles();
  const repository = useMemo(() => (active ? new LocalStorageRepository(dataKey(active.id)) : null), [active]);

  if (!active || !repository) {
    return (
      <ThemeProvider storageKey="easy-money.theme">
        <Routes>
          <Route path="*" element={<ProfilesPage />} />
        </Routes>
      </ThemeProvider>
    );
  }

  // Keyed by profile so switching remounts the store and theme with that profile's data.
  return (
    <ThemeProvider key={active.id} storageKey={themeKey(active.id)}>
      <StoreProvider repository={repository}>
        <AppRoutes />
      </StoreProvider>
    </ThemeProvider>
  );
}

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
