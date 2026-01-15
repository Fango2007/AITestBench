import { useEffect, useMemo, useState } from 'react';

import { InferenceServerRecord, listInferenceServers } from '../services/inference-servers-api.js';

type ModelServerInfo = {
  server_id: string;
  display_name: string;
  base_url: string;
  schema_families: string[];
};

type ModelAggregate = {
  model_id: string;
  display_name: string;
  context_windows: number[];
  quantisations: string[];
  servers: ModelServerInfo[];
};

export function Models() {
  const [servers, setServers] = useState<InferenceServerRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listInferenceServers()
      .then((data) => setServers(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load models'))
      .finally(() => setLoading(false));
  }, []);

  const models = useMemo<ModelAggregate[]>(() => {
    const map = new Map<string, ModelAggregate>();
    for (const server of servers) {
      const schemaFamilies = server.runtime.api.schema_family;
      for (const model of server.discovery.model_list.normalised) {
        if (!model.model_id) {
          continue;
        }
        const existing = map.get(model.model_id);
        const displayName = model.display_name ?? model.model_id;
        if (!existing) {
          map.set(model.model_id, {
            model_id: model.model_id,
            display_name: displayName,
            context_windows: model.context_window_tokens != null ? [model.context_window_tokens] : [],
            quantisations: model.quantisation ? [model.quantisation] : [],
            servers: [
              {
                server_id: server.inference_server.server_id,
                display_name: server.inference_server.display_name,
                base_url: server.endpoints.base_url,
                schema_families: schemaFamilies
              }
            ]
          });
          continue;
        }
        if (existing.display_name === existing.model_id && model.display_name) {
          existing.display_name = model.display_name;
        }
        if (
          model.context_window_tokens != null &&
          !existing.context_windows.includes(model.context_window_tokens)
        ) {
          existing.context_windows.push(model.context_window_tokens);
        }
        if (model.quantisation && !existing.quantisations.includes(model.quantisation)) {
          existing.quantisations.push(model.quantisation);
        }
        if (!existing.servers.some((entry) => entry.server_id === server.inference_server.server_id)) {
          existing.servers.push({
            server_id: server.inference_server.server_id,
            display_name: server.inference_server.display_name,
            base_url: server.endpoints.base_url,
            schema_families: schemaFamilies
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.display_name.localeCompare(b.display_name));
  }, [servers]);

  useEffect(() => {
    if (!models.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !models.some((model) => model.model_id === selectedId)) {
      setSelectedId(models[0].model_id);
    }
  }, [models, selectedId]);

  const selectedModel = models.find((model) => model.model_id === selectedId) ?? null;
  const contextLabel = selectedModel?.context_windows.length
    ? selectedModel.context_windows.sort((a, b) => a - b).join(', ')
    : 'N/A';
  const quantLabel = selectedModel?.quantisations.length
    ? selectedModel.quantisations.join(', ')
    : 'N/A';

  return (
    <section className="page">
      <div className="page-header">
        <h2>Models</h2>
        <p className="muted">Browse models discovered across inference servers.</p>
      </div>
      {error ? <div className="error">{error}</div> : null}
      {loading ? <p className="muted">Loading models…</p> : null}
      <div className="models-layout">
        <div className="models-panel">
          <div className="card">
            <div className="panel-header">
              <h3>Available models</h3>
              <span className="muted">{models.length}</span>
            </div>
            {models.length === 0 ? (
              <p className="muted">No models discovered yet.</p>
            ) : (
              <ul className="list">
                {models.map((model) => (
                  <li
                    key={model.model_id}
                    className={`list-item ${model.model_id === selectedId ? 'selected' : ''}`}
                  >
                    <button
                      type="button"
                      className="list-button"
                      onClick={() => setSelectedId(model.model_id)}
                    >
                      <div>
                        <strong>{model.display_name}</strong>
                        <div className="muted">{model.model_id}</div>
                      </div>
                      <span className="muted">{model.servers.length} servers</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="details-panel">
          <div className="card">
            <div className="panel-header">
              <h3>Model details</h3>
            </div>
            {!selectedModel ? (
              <p className="muted">Select a model to view characteristics.</p>
            ) : (
              <>
                <div className="detail-row">
                  <span>Display name</span>
                  <strong>{selectedModel.display_name}</strong>
                </div>
                <div className="detail-row">
                  <span>Model ID</span>
                  <strong>{selectedModel.model_id}</strong>
                </div>
                <div className="detail-row">
                  <span>Context window</span>
                  <strong>{contextLabel}</strong>
                </div>
                <div className="detail-row">
                  <span>Quantisation</span>
                  <strong>{quantLabel}</strong>
                </div>
                <div className="divider" />
                <div className="detail-row">
                  <span>Servers</span>
                  <span className="muted">{selectedModel.servers.length}</span>
                </div>
                <div className="models-server-list">
                  {selectedModel.servers.map((server) => (
                    <div key={server.server_id} className="models-server-card">
                      <strong>{server.display_name}</strong>
                      <div className="muted">{server.base_url}</div>
                      <div className="meta">Schemas: {server.schema_families.join(', ')}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
