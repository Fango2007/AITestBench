import { NavLink } from 'react-router-dom';

interface SidebarHealth {
  backend: 'unknown' | 'up' | 'down';
  database: 'unknown' | 'up' | 'down';
  servers: {
    total: number;
    failed: number;
    unavailable: boolean;
  };
}

interface SidebarProps {
  version: string;
  health: SidebarHealth;
  templateCount: number | null;
  runCount: number | null;
  onSettings: () => void;
}

const navItems = [
  { to: '/catalog?tab=servers', section: '/catalog', label: 'Catalog', sub: 'Servers · Models' },
  { to: '/templates', section: '/templates', label: 'Templates', sub: 'JSON · Python', badge: 'templates' },
  { to: '/run', section: '/run', label: 'Run', sub: '1-8 models' },
  { to: '/results?tab=dashboard', section: '/results', label: 'Results', sub: 'Dash · Board · History', badge: 'runs' },
  { to: '/evaluate', section: '/evaluate', label: 'Evaluate', sub: 'Score queue' }
] as const;

function statusLabel(status: 'unknown' | 'up' | 'down') {
  if (status === 'up') {
    return 'Online';
  }
  if (status === 'down') {
    return 'Offline';
  }
  return 'Checking';
}

function serverStatus(health: SidebarHealth['servers']): 'unknown' | 'up' | 'down' {
  if (health.unavailable) {
    return 'down';
  }
  if (health.total === 0) {
    return 'unknown';
  }
  return health.failed > 0 ? 'down' : 'up';
}

function RegLightRow({
  status,
  label,
  detail
}: {
  status: 'unknown' | 'up' | 'down';
  label: string;
  detail?: string;
}) {
  return (
    <div className={`sidebar-health-row sidebar-health-row--${status}`}>
      <span className="sidebar-health-row__dot" aria-hidden="true" />
      <span>{label}</span>
      {detail ? <strong>{detail}</strong> : null}
    </div>
  );
}

export function Sidebar({ version, health, templateCount, runCount, onSettings }: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="sidebar-brand">
        <strong>AITestBench</strong>
        <span>v{version}</span>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.section}
            to={item.to}
            className={({ isActive }) => (isActive ? 'sidebar-item is-active' : 'sidebar-item')}
          >
            <span className="sidebar-item__main">
              <span>{item.label}</span>
              {item.badge === 'templates' && templateCount !== null ? <b>{templateCount}</b> : null}
              {item.badge === 'runs' && runCount !== null ? <b>{runCount}</b> : null}
            </span>
            <span className="sidebar-item__sub">{item.sub}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-health">
        <div className="sidebar-health__label">Health</div>
        <RegLightRow status={health.backend} label="Backend" detail={statusLabel(health.backend)} />
        <RegLightRow status={health.database} label="Database" detail={statusLabel(health.database)} />
        <RegLightRow
          status={serverStatus(health.servers)}
          label={`${health.servers.total} servers`}
          detail={health.servers.failed > 0 ? `${health.servers.failed} issues` : undefined}
        />
      </div>
      <div className="sidebar-settings">
        <button type="button" onClick={onSettings}>
          <span aria-hidden="true">S</span>
          <strong>Settings</strong>
        </button>
      </div>
    </aside>
  );
}
