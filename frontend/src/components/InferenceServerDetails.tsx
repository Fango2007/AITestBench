import { InferenceServerRecord } from '../services/inference-servers-api.js';

interface InferenceServerDetailsProps {
  servers: InferenceServerRecord[];
  selectedId: string | null;
  onSelect: (serverId: string) => void;
  server: InferenceServerRecord | null;
  onRefreshRuntime: () => void;
  onRefreshDiscovery: () => void;
  onEdit: (server: InferenceServerRecord) => void;
  onArchive: (server: InferenceServerRecord) => void;
  onDelete: (server: InferenceServerRecord) => void;
  refreshEnabled: boolean;
  busy?: boolean;
}

export function InferenceServerDetails({
  servers,
  selectedId,
  onSelect,
  server,
  onRefreshRuntime,
  onRefreshDiscovery,
  onEdit,
  onArchive,
  onDelete,
  refreshEnabled,
  busy
}: InferenceServerDetailsProps) {
  const renderDetails = () => {
    if (!server) {
      return null;
    }
    const tokenStatus = server.auth.token_env ? 'Present (masked)' : 'None';
    const archivedLabel = server.inference_server.archived
      ? 'Archived'
      : server.inference_server.active
        ? 'Active'
        : 'Inactive';
    const runtime = server.runtime;
    const discovery = server.discovery;
    const gpuLabel = runtime.hardware.gpu.length
      ? runtime.hardware.gpu.map((gpu) => `${gpu.vendor}${gpu.model ? ` ${gpu.model}` : ''}`).join(', ')
      : 'None';

    return (
      <>
        <div className="details-grid">
          <div className="detail-row">
            <span>Inference Server</span>
            <strong>{server.inference_server.display_name}</strong>
          </div>
          <div className="detail-row">
            <span>Server ID</span>
            <strong>{server.inference_server.server_id}</strong>
          </div>
          <div className="detail-row">
            <span>Base URL</span>
            <strong>{server.endpoints.base_url}</strong>
          </div>
          <div className="detail-row">
            <span>Health URL</span>
            <strong>{server.endpoints.health_url ?? 'None'}</strong>
          </div>
          <div className="detail-row">
            <span>HTTPS</span>
            <strong>{server.endpoints.https ? 'Yes' : 'No'}</strong>
          </div>
          <div className="detail-row">
            <span>Created at</span>
            <strong>{server.inference_server.created_at}</strong>
          </div>
          <div className="detail-row">
            <span>Updated at</span>
            <strong>{server.inference_server.updated_at}</strong>
          </div>
          {server.inference_server.archived_at ? (
            <div className="detail-row">
              <span>Archived at</span>
              <strong>{server.inference_server.archived_at}</strong>
            </div>
          ) : null}
          <div className="detail-row">
            <span>Auth type</span>
            <strong>{server.auth.type}</strong>
          </div>
          <div className="detail-row">
            <span>Token status</span>
            <strong>{tokenStatus}</strong>
          </div>
          <div className="detail-row">
            <span>Token env</span>
            <strong>{server.auth.token_env ?? 'None'}</strong>
          </div>
          <div className="detail-row">
            <span>Auth header</span>
            <strong>{server.auth.header_name}</strong>
          </div>
          <div className="divider details-span" />
          <div className="detail-row">
            <span>Schema family</span>
            <strong>{runtime.api.schema_family.join(', ')}</strong>
          </div>
          <div className="detail-row">
            <span>API version</span>
            <strong>{runtime.api.api_version ?? 'Unknown'}</strong>
          </div>
          <div className="detail-row">
            <span>Server software</span>
            <strong>{runtime.server_software.name}</strong>
          </div>
          <div className="detail-row">
            <span>Runtime retrieved</span>
            <strong>{runtime.retrieved_at}</strong>
          </div>
          <div className="detail-row">
            <span>Runtime source</span>
            <strong>{runtime.source}</strong>
          </div>
          <div className="detail-row">
            <span>OS</span>
            <strong>
              {`${runtime.platform.os.name} ${runtime.platform.os.version ?? ''}`.trim()} ·{' '}
              {runtime.platform.os.arch}
            </strong>
          </div>
          <div className="detail-row">
            <span>CPU</span>
            <strong>{runtime.hardware.cpu.model ?? 'Unknown'}</strong>
          </div>
          <div className="detail-row">
            <span>GPU</span>
            <strong>{gpuLabel}</strong>
          </div>
          <div className="detail-row">
            <span>RAM</span>
            <strong>{runtime.hardware.ram_mb ? `${runtime.hardware.ram_mb} MB` : 'Unknown'}</strong>
          </div>
          <div className="detail-row">
            <span>Discovery retrieved</span>
            <strong>{discovery.retrieved_at}</strong>
          </div>
          <div className="detail-row">
            <span>Discovery TTL</span>
            <strong>{`${discovery.ttl_seconds}s`}</strong>
          </div>
          <div className="detail-row">
            <span>Models served</span>
            <strong>{discovery.model_list.normalised.length}</strong>
          </div>
          <div className="detail-row details-span">
            <span>Refresh</span>
            <div className="actions">
              <button type="button" onClick={onRefreshRuntime} disabled={busy || !refreshEnabled}>
                Refresh runtime
              </button>
              <button type="button" onClick={onRefreshDiscovery} disabled={busy || !refreshEnabled}>
                Refresh discovery
              </button>
              <button type="button" onClick={() => onEdit(server)} disabled={busy}>
                Update
              </button>
              <button type="button" onClick={() => onDelete(server)} disabled={busy}>
                Delete
              </button>
              <button type="button" onClick={() => onArchive(server)} disabled={busy}>
                {server.inference_server.archived ? 'Unarchive' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
        <details className="details-collapsible">
          <summary>Capabilities</summary>
          <div className="detail-row">
            <span>Streaming</span>
            <strong>{server.capabilities.server.streaming ? 'Yes' : 'No'}</strong>
          </div>
          <div className="detail-row">
            <span>Models endpoint</span>
            <strong>{server.capabilities.server.models_endpoint ? 'Yes' : 'No'}</strong>
          </div>
          <div className="detail-row">
            <span>Tools</span>
            <strong>{server.capabilities.generation.tools ? 'Yes' : 'No'}</strong>
          </div>
          <div className="detail-row">
            <span>Embeddings</span>
            <strong>{server.capabilities.generation.embeddings ? 'Yes' : 'No'}</strong>
          </div>
          <div className="detail-row">
            <span>Vision input</span>
            <strong>{server.capabilities.multimodal.vision.input_images ? 'Yes' : 'No'}</strong>
          </div>
          <div className="detail-row">
            <span>Audio input</span>
            <strong>{server.capabilities.multimodal.audio.input_audio ? 'Yes' : 'No'}</strong>
          </div>
        </details>
        <details className="details-collapsible">
          <summary>Raw payloads</summary>
          <div className="detail-row">
            <span>Raw server</span>
            <pre className="code-block">{JSON.stringify(server.raw, null, 2)}</pre>
          </div>
          <div className="detail-row">
            <span>Discovery raw</span>
            <pre className="code-block">
              {JSON.stringify(server.discovery.model_list.raw, null, 2)}
            </pre>
          </div>
        </details>
      </>
    );
  };

  return (
    <div className="card">
      <div className="panel-header">
      </div>
      {servers.length ? (
        <div className="details-tabs">
          {servers.map((entry) => (
            <button
              key={entry.inference_server.server_id}
              type="button"
              className={entry.inference_server.server_id === selectedId ? 'active' : undefined}
              onClick={() => onSelect(entry.inference_server.server_id)}
            >
              <span className="details-tab-name">{entry.inference_server.display_name}</span>
              {entry.inference_server.archived ? (
                <span className="details-tab-status">Archived</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : (
        <p className="muted">No inference servers available.</p>
      )}
      {!server ? (
        <p className="muted">Select an inference server tab to view metadata and capabilities.</p>
      ) : null}
      {renderDetails()}
    </div>
  );
}
