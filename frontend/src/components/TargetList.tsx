import { TargetRecord } from '../services/targets-api.js';

interface TargetListProps {
  targets: TargetRecord[];
  title: string;
  onEdit: (target: TargetRecord) => void;
  onArchive: (target: TargetRecord) => void;
  onDelete: (target: TargetRecord) => void;
  onRetry: (target: TargetRecord) => void;
  selectedId?: string | null;
  onInspect: (target: TargetRecord) => void;
}

export function TargetList({
  targets,
  title,
  onEdit,
  onArchive,
  onDelete,
  onRetry,
  selectedId,
  onInspect
}: TargetListProps) {
  if (!targets.length) {
    return (
      <div className="card">
        <h2>{title}</h2>
        <p className="muted">No targets found.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h4>{title}</h4>
      <ul className="list">
        {targets.map((target) => (
          <li
            key={target.id}
            className={`list-item server-card ${selectedId === target.id ? 'selected' : ''}`}
          >
            <div>
              <strong>{target.name}</strong>
              <div className="muted">{target.base_url}</div>
              <div className="meta">
                Status:{' '}
                <span className={`status-text ${target.connectivity_status}`}>
                  {target.connectivity_status === 'ok'
                    ? 'Online'
                    : target.connectivity_status === 'failed'
                      ? 'Offline'
                      : 'Pending'}
                </span>
                {target.last_error ? ` • ${target.last_error}` : ''}
              </div>
            </div>
            <div className="actions icon-actions">
              <button
                type="button"
                className="icon-button"
                onClick={() => onInspect(target)}
                aria-label="Inspect"
                title="Inspect"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <path
                    d="M12 10v6M12 7h.01"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => onEdit(target)}
                aria-label="Edit"
                title="Edit"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M5 16l9-9 4 4-9 9H5v-4zM14 7l3-3 3 3-3 3-3-3z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {target.connectivity_status === 'failed' && (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => onRetry(target)}
                  aria-label="Retry"
                  title="Retry"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
              {target.status === 'active' ? (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => onArchive(target)}
                  aria-label="Archive"
                  title="Archive"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M4 8h16M7 8l1-3h8l1 3M8 12h8M9 12v6h6v-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              ) : null}
              <button
                type="button"
                className="icon-button danger"
                onClick={() => onDelete(target)}
                aria-label="Delete"
                title="Delete"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M5 7h14M9 7V5h6v2M9 10v7M15 10v7M7 7l1 12h8l1-12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
