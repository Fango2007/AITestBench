import { ReactNode } from 'react';

import { SubTab, SubTabBar } from './SubTabBar.js';

interface MergedPageHeaderProps {
  title: string;
  subtitle: string;
  tabs?: SubTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  action?: ReactNode;
  tabAction?: ReactNode;
}

export function MergedPageHeader({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  action,
  tabAction
}: MergedPageHeaderProps) {
  return (
    <header className="merged-page-header">
      <div className="merged-page-header__row">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {action ? <div className="merged-page-header__action">{action}</div> : null}
      </div>
      {tabs && activeTab && onTabChange ? (
        <div className="merged-page-header__tabs-row">
          <SubTabBar tabs={tabs} active={activeTab} onChange={onTabChange} />
          {tabAction ? <div className="merged-page-header__tab-action">{tabAction}</div> : null}
        </div>
      ) : null}
    </header>
  );
}
