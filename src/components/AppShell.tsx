import { NavLink, Outlet } from 'react-router-dom';
import { Brand } from './Brand';
import { Icon, type IconName } from './Icon';
import { useProfiles } from '../state/profileContext';
import { useStore } from '../state/store';

function Item({ to, icon, label, end }: { to: string; icon: IconName; label: string; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <Icon name={icon} size={22} />
      <span className="label">{label}</span>
    </NavLink>
  );
}

/**
 * The app frame after setup. Bottom tabs on phones, an icon rail on tablets,
 * and a full sidebar on desktop, all from the same markup.
 */
export function AppShell() {
  const { data } = useStore();
  const { active } = useProfiles();
  const showAhead = data.answers.horizon !== 'this';
  const showExtra = data.answers.bonuses !== 'none';
  return (
    <div className="shell">
      <nav className="shell-nav" aria-label="Main">
        <div className="brand-wrap">
          <Brand to="/app" />
          {active && (
            <span className="small muted" style={{ display: 'block', paddingTop: 6 }}>
              {active.name}&rsquo;s budget
            </span>
          )}
        </div>
        <Item to="/app" end icon="wallet" label="This paycheck" />
        <Item to="/app/plan" icon="calendar" label="Plan" />
        {showAhead && <Item to="/app/ahead" icon="arrow" label="Ahead" />}
        {showExtra && <Item to="/app/extra" icon="star" label="Extra money" />}
        <Item to="/app/buckets" icon="grid" label="Buckets" />
        <div className="nav-foot">
          <Item to="/app/settings" icon="settings" label="Settings" />
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
