import { TargetRecord } from '../services/targets-api.js';

interface TargetDetailsProps {
  target: TargetRecord | null;
}

export function TargetDetails({ target }: TargetDetailsProps) {
  if (!target) {
    return (
      <div className="card">
        <h3>Target inspector</h3>
        <p className="muted">Select a target to inspect connectivity and metadata.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Target inspector</h3>
      <div className="detail-row">
        <span>Name</span>
        <strong>{target.name}</strong>
      </div>
      <div className="detail-row">
        <span>Base URL</span>
        <strong>{target.base_url}</strong>
      </div>
      <div className="detail-row">
        <span>Connectivity</span>
        <strong>{target.connectivity_status}</strong>
      </div>
      <div className="detail-row">
        <span>Provider</span>
        <strong>{target.provider}</strong>
      </div>
      <div className="detail-row">
        <span>Last check</span>
        <strong>{target.last_check_at ?? 'Not yet run'}</strong>
      </div>
      {target.last_error ? (
        <div className="detail-row">
          <span>Last error</span>
          <strong>{target.last_error}</strong>
        </div>
      ) : null}
      <div className="detail-row">
        <span>Auth token ref</span>
        <strong>{target.auth_token_ref ?? 'None'}</strong>
      </div>
      <div className="detail-row">
        <span>Default model</span>
        <strong>{target.default_model ?? 'Not set'}</strong>
      </div>
      <div className="detail-row">
        <span>Concurrency</span>
        <strong>{target.concurrency_limit ?? 'Default'}</strong>
      </div>
      <div className="divider" />
      <h4>Models</h4>
      {target.models && target.models.length > 0 ? (
        <ul className="list">
          {target.models.map((model) => (
            <li key={`${model.provider ?? 'unknown'}-${model.name}`} className="list-item">
              <div>
                <strong>{model.name}</strong>
                <div className="muted">{model.provider ?? 'unknown provider'}</div>
              </div>
              <div className="muted">{model.version ?? 'latest'}</div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No models available yet.</p>
      )}
    </div>
  );
}
