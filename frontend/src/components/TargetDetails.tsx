import { TargetRecord } from '../services/targets-api.js';

interface TargetDetailsProps {
  target: TargetRecord | null;
  statusLabel: (status: TargetRecord['connectivity_status']) => string;
  streamingSupport: string;
}

export function TargetDetails({ target, statusLabel, streamingSupport }: TargetDetailsProps) {
  if (!target) {
    return (
      <div className="card">
        <h3>Server details</h3>
        <p className="muted">Select a server to inspect connectivity and metadata.</p>
      </div>
    );
  }

  const providerLabel =
    target.provider === 'ollama'
      ? 'Ollama'
      : target.provider === 'openai'
        ? 'OpenAI-compatible'
        : 'OpenAI-compatible (auto)';
  const connectivityLabel = statusLabel(target.connectivity_status);
  const tokenStatus = target.auth_token_ref ? 'Present (masked)' : 'None';
  const supportsModels = target.models && target.models.length > 0;
  const supportsTools = target.models?.some((model) => model.capabilities?.tools) ?? false;
  const supportsVision = target.models?.some((model) => model.capabilities?.vision) ?? false;

  return (
    <div className="card">
      <h3>Server details</h3>
      <div className="detail-row">
        <span>Inference Server</span>
        <strong>{target.name}</strong>
      </div>
      <div className="detail-row">
        <span>Base URL</span>
        <strong>{target.base_url}</strong>
      </div>
      <div className="detail-row">
        <span>Provider</span>
        <strong>{providerLabel}</strong>
      </div>
      <div className="detail-row">
        <span>Last check</span>
        <strong>{target.last_check_at ?? 'Not yet run'}</strong>
      </div>
      <div className="detail-row">
        <span>Connectivity</span>
        <strong className={`status-text ${target.connectivity_status}`}>{connectivityLabel}</strong>
      </div>
      {target.last_error ? (
        <div className="detail-row">
          <span>Last error</span>
          <strong>{target.last_error}</strong>
        </div>
      ) : null}
      <div className="detail-row">
        <span>Token source</span>
        <strong>{target.auth_token_ref ?? 'None'}</strong>
      </div>
      <div className="detail-row">
        <span>Token status</span>
        <strong>{tokenStatus}</strong>
      </div>
      <div className="detail-row">
        <span>Concurrency</span>
        <strong>{target.concurrency_limit ?? 'Default'}</strong>
      </div>
      <div className="detail-row">
        <span>Timeouts</span>
        <strong>{target.timeouts ? 'Custom' : 'Default'}</strong>
      </div>
      <div className="detail-row">
        <span>Streaming</span>
        <strong>{streamingSupport}</strong>
      </div>
      <div className="divider" />
      <details className="details-collapsible">
        <summary>Capabilities</summary>
        <div className="detail-row">
          <span>Models endpoint</span>
          <strong>{supportsModels ? 'Yes' : 'No'}</strong>
        </div>
        <div className="detail-row">
          <span>Chat completions</span>
          <strong>{supportsModels ? 'Yes' : 'Unknown'}</strong>
        </div>
        <div className="detail-row">
          <span>Tool calling</span>
          <strong>{supportsTools ? 'Yes' : 'No'}</strong>
        </div>
        <div className="detail-row">
          <span>Streaming</span>
          <strong>{streamingSupport}</strong>
        </div>
        <div className="detail-row">
          <span>Embeddings</span>
          <strong>No</strong>
        </div>
        <div className="detail-row">
          <span>Vision</span>
          <strong>{supportsVision ? 'Yes' : 'No'}</strong>
        </div>
      </details>
    </div>
  );
}
