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
      <h2>{title}</h2>
      <ul className="list">
        {targets.map((target) => (
          <li key={target.id} className={`list-item ${selectedId === target.id ? 'selected' : ''}`}>
            <div>
              <strong>{target.name}</strong>
              <div className="muted">{target.base_url}</div>
              <div className="meta">
                Status: {target.connectivity_status}
                {target.last_error ? ` • ${target.last_error}` : ''}
              </div>
              <div className="meta">Models: {target.models?.length ?? 0}</div>
            </div>
            <div className="actions">
              <button type="button" onClick={() => onInspect(target)}>
                Inspect
              </button>
              <button type="button" onClick={() => onEdit(target)}>
                Edit
              </button>
              {target.connectivity_status === 'failed' && (
                <button type="button" onClick={() => onRetry(target)}>
                  Retry
                </button>
              )}
              {target.status === 'active' ? (
                <button type="button" onClick={() => onArchive(target)}>
                  Archive
                </button>
              ) : null}
              <button type="button" onClick={() => onDelete(target)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
