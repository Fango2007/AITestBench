import type { ReactNode } from 'react';

export function EmptyState({
  title,
  body,
  actions,
  className = ''
}: {
  title: string;
  body: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`empty-state ${className}`}>
      <div className="empty-state__blocks" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <h2>{title}</h2>
      <p>{body}</p>
      {actions ? <div className="empty-state__actions">{actions}</div> : null}
    </div>
  );
}
