import { ReactNode } from 'react';

import { SubTab, SubTabBar } from './SubTabBar.js';

interface MergedPageHeaderProps {
  title: string;
  subtitle: string;
  tabs?: SubTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  action?: ReactNode;
}

export function MergedPageHeader({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  action
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
        <SubTabBar tabs={tabs} active={activeTab} onChange={onTabChange} />
      ) : null}
    </header>
  );
}
