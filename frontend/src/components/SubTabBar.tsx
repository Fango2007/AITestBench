export interface SubTab {
  id: string;
  label: string;
  sub?: string;
}

interface SubTabBarProps {
  tabs: SubTab[];
  active: string;
  onChange: (id: string) => void;
}

export function SubTabBar({ tabs, active, onChange }: SubTabBarProps) {
  return (
    <div className="sub-tab-bar" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === active}
          className={tab.id === active ? 'sub-tab is-active' : 'sub-tab'}
          onClick={() => onChange(tab.id)}
        >
          <span>{tab.label}</span>
          {tab.sub ? <small>{tab.sub}</small> : null}
        </button>
      ))}
    </div>
  );
}
