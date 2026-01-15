import { InferenceServerRecord } from '../services/inference-servers-api.js';

interface InferenceServerListProps {
  servers: InferenceServerRecord[];
  title: string;
  onEdit: (server: InferenceServerRecord) => void;
  onArchive: (server: InferenceServerRecord) => void;
  onUnarchive: (server: InferenceServerRecord) => void;
  onDelete: (server: InferenceServerRecord) => void;
  selectedId?: string | null;
  onInspect: (server: InferenceServerRecord) => void;
}

export function InferenceServerList({
  servers,
  title,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
  selectedId,
  onInspect
}: InferenceServerListProps) {
  if (!servers.length) {
    return (
      <div className="card">
        <h2>{title}</h2>
        <p className="muted">No inference servers found.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h4>{title}</h4>
      <ul className="list">
        {servers.map((server) => {
          return (
          <li
            key={server.inference_server.server_id}
            className={`list-item server-card ${
              selectedId === server.inference_server.server_id ? 'selected' : ''
            }`}
          >
            <div>
              <strong>{server.inference_server.display_name}</strong>
            </div>
            <div className="actions icon-actions">
              <button
                type="button"
                className="icon-button"
                onClick={() => onInspect(server)}
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
                onClick={() => onEdit(server)}
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
              {!server.inference_server.archived ? (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => onArchive(server)}
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
              ) : (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => onUnarchive(server)}
                  aria-label="Unarchive"
                  title="Unarchive"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M4 8h16M7 8l1-3h8l1 3M12 12v6M9 15l3 3 3-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
              <button
                type="button"
                className="icon-button"
                onClick={() => onDelete(server)}
                aria-label="Delete"
                title="Delete"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M4 7h16M9 7V5h6v2m-7 3v8m4-8v8m4-8v8M7 7l1 12h8l1-12"
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
        );
        })}
      </ul>
    </div>
  );
}
