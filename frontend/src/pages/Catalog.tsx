import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { MergedPageHeader } from '../components/MergedPageHeader.js';
import { EmptyState } from '../components/EmptyState.js';
import { InferenceContextBar } from '../components/InferenceContextBar.js';
import { RegLight } from '../components/RegLight.js';
import { catalogSearch, normalizeCatalogTab } from '../navigation.js';
import { InferenceServerHealth, getConnectivityConfig, getInferenceServerHealth } from '../services/connectivity-api.js';
import {
  ApiSchemaFamily,
  AuthType,
  InferenceServerInput,
  InferenceServerRecord,
  archiveInferenceServer,
  createInferenceServer,
  deleteInferenceServer,
  listInferenceServers,
  refreshInferenceServerDiscovery,
  unarchiveInferenceServer,
  updateInferenceServer
} from '../services/inference-servers-api.js';
import { ModelFormat, ModelRecord, listModels } from '../services/models-api.js';
import { DEFAULT_INFERENCE_PARAMS, type InferenceParams } from '../services/inference-param-presets-api.js';
import { ModelDetails } from './ModelDetails.js';

type CatalogModel = {
  key: string;
  serverId: string;
  serverName: string;
  serverUrl: string;
  modelId: string;
  displayName: string;
  family: string;
  quantization: string;
  format: string;
  context: string;
  tools: boolean;
  streaming: boolean;
};

type ServerStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

type DrawerMode = { kind: 'create' } | { kind: 'edit'; server: InferenceServerRecord };

const SERVER_STAGE_STORAGE_KEY = 'catalog.serverStageCollapsed';
const MODEL_FILTER_STAGE_STORAGE_KEY = 'catalog.modelFilterStageCollapsed';

function parseCsv(value: string | null): string[] {
  return value?.split(',').map((item) => item.trim()).filter(Boolean) ?? [];
}

function writeCsv(params: URLSearchParams, key: string, values: Iterable<string>) {
  const list = Array.from(values).filter(Boolean);
  if (list.length) {
    params.set(key, list.join(','));
  } else {
    params.delete(key);
  }
}

function formatProvider(provider: string): string {
  if (provider === 'meta') return 'Llama';
  if (provider === 'qwen') return 'Qwen';
  if (provider === 'mistral') return 'Mistral';
  if (provider === 'google') return 'Gemma';
  if (provider === 'unknown') return 'Custom';
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function modelLabel(record: ModelRecord | undefined, modelId: string, displayName: string): string {
  return record?.model.base_model_name?.trim() ?? record?.model.display_name?.trim() ?? (displayName || modelId);
}

function statusFor(server: InferenceServerRecord, health?: InferenceServerHealth): ServerStatus {
  if (server.inference_server.archived || !server.inference_server.active) return 'down';
  if (!health) return 'unknown';
  if (health.ok) return 'healthy';
  return health.response_time_ms != null ? 'degraded' : 'down';
}

function statusLabel(status: ServerStatus): string {
  switch (status) {
    case 'healthy':
      return 'online';
    case 'degraded':
      return 'degraded';
    case 'down':
      return 'down';
    default:
      return 'unknown';
  }
}

function statusToRegLight(status: ServerStatus): 'healthy' | 'degraded' | 'down' | 'unknown' {
  return status;
}

function relativeTime(value: string | null | undefined): string {
  if (!value) return 'never';
  const time = Date.parse(value);
  if (Number.isNaN(time)) return 'unknown';
  const delta = Math.max(0, Date.now() - time);
  const seconds = Math.round(delta / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function gpuLabel(server: InferenceServerRecord): string {
  const labels = server.runtime.hardware.gpu
    .map((gpu) => [gpu.model, gpu.vram_mb ? `${Math.round(gpu.vram_mb / 1024)}GB` : null].filter(Boolean).join(' · '))
    .filter(Boolean);
  return labels.join(', ') || 'GPU unknown';
}

function runtimeLabel(server: InferenceServerRecord): string {
  const name = server.runtime.server_software.name || 'unknown';
  const version = server.runtime.server_software.version;
  return version ? `${name} · ${version}` : name;
}

function buildCatalogModels(servers: InferenceServerRecord[], modelRecords: ModelRecord[]): CatalogModel[] {
  const recordMap = new Map(modelRecords.map((record) => [`${record.model.server_id}:${record.model.model_id}`, record]));
  const entries = new Map<string, CatalogModel>();
  const put = (server: InferenceServerRecord, modelId: string, displayName: string, context: number | null, quantLabel?: string | null) => {
    const record = recordMap.get(`${server.inference_server.server_id}:${modelId}`);
    const label = modelLabel(record, modelId, displayName);
    const format = record?.architecture.format ?? 'Unknown';
    const quantization =
      record?.architecture.quantisation.weight_format
      ?? (record?.architecture.quantisation.bits ? `${record.architecture.quantisation.bits}-bit` : null)
      ?? (record ? quantLabel : null)
      ?? 'Unknown';
    const key = `${server.inference_server.server_id}:${modelId}`;
    entries.set(key, {
      key,
      serverId: server.inference_server.server_id,
      serverName: server.inference_server.display_name,
      serverUrl: server.endpoints.base_url,
      modelId,
      displayName: label,
      family: formatProvider(record?.identity.provider ?? 'unknown'),
      quantization,
      format,
      context: (record?.limits.context_window_tokens ?? context) ? `${record?.limits.context_window_tokens ?? context} ctx` : 'ctx unknown',
      tools: server.capabilities.generation.tools,
      streaming: server.capabilities.server.streaming
    });
  };

  for (const server of servers) {
    for (const model of server.discovery.model_list.normalised) {
      if (!model.model_id) continue;
      const quantLabel = typeof model.quantisation === 'string'
        ? model.quantisation
        : model.quantisation?.weight_format ?? (model.quantisation?.bits ? `${model.quantisation.bits}-bit` : null);
      put(server, model.model_id, model.display_name ?? model.model_id, model.context_window_tokens, quantLabel);
    }
  }

  for (const record of modelRecords) {
    const server = servers.find((candidate) => candidate.inference_server.server_id === record.model.server_id);
    if (!server) continue;
    put(server, record.model.model_id, record.model.display_name, record.limits.context_window_tokens);
  }

  return Array.from(entries.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function toggleSetValue(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

export function Catalog({
  serversSnapshot,
  connectivitySnapshot
}: {
  serversSnapshot: InferenceServerRecord[];
  connectivitySnapshot: Record<string, InferenceServerHealth>;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeTab = normalizeCatalogTab(searchParams.get('tab'));
  const inspectorServerId = searchParams.get('serverId');
  const inspectorModelId = searchParams.get('modelId');
  const healthView = activeTab === 'servers' && searchParams.get('view') === 'health';

  const [servers, setServers] = useState<InferenceServerRecord[]>(serversSnapshot);
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [connectivity, setConnectivity] = useState<Record<string, InferenceServerHealth>>(connectivitySnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerMode | null>(null);
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);
  const [serverFiltersOpen, setServerFiltersOpen] = useState(false);
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [serverStageCollapsed, setServerStageCollapsed] = useState(() => localStorage.getItem(SERVER_STAGE_STORAGE_KEY) === 'true');
  const [serverFilters, setServerFilters] = useState({ status: new Set<string>(), runtime: new Set<string>(), gpu: new Set<string>() });
  const [inferenceParams, setInferenceParams] = useState<InferenceParams>(DEFAULT_INFERENCE_PARAMS);

  const selectedServers = useMemo(() => new Set(parseCsv(searchParams.get('servers'))), [searchParams]);
  const selectedFamilies = useMemo(() => new Set(parseCsv(searchParams.get('family'))), [searchParams]);
  const selectedQuantizations = useMemo(() => new Set(parseCsv(searchParams.get('quantization'))), [searchParams]);
  const selectedFormats = useMemo(() => new Set(parseCsv(searchParams.get('format'))), [searchParams]);

  async function refreshData(showLoading = false) {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const [serverRows, modelRows, healthRows] = await Promise.all([
        listInferenceServers(),
        listModels(),
        getInferenceServerHealth().catch(() => [])
      ]);
      const nextHealth: Record<string, InferenceServerHealth> = {};
      for (const health of healthRows) {
        nextHealth[health.server_id] = health;
      }
      setServers(serverRows);
      setModels(modelRows);
      setConnectivity(nextHealth);
      setSelectedDetailId((current) => current && serverRows.some((server) => server.inference_server.server_id === current)
        ? current
        : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load catalog');
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    refreshData(true);
    let isActive = true;
    let intervalId: number | null = null;
    getConnectivityConfig()
      .then((config) => {
        if (!isActive) return;
        intervalId = window.setInterval(() => refreshData(false), Math.max(1000, config.poll_interval_ms));
      })
      .catch(() => {
        if (!isActive) return;
        intervalId = window.setInterval(() => refreshData(false), 30000);
      });
    return () => {
      isActive = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => setServers(serversSnapshot), [serversSnapshot]);
  useEffect(() => setConnectivity(connectivitySnapshot), [connectivitySnapshot]);

  useEffect(() => {
    if (searchParams.get('tab') === activeTab) return;
    const next = new URLSearchParams(searchParams);
    next.set('tab', activeTab);
    setSearchParams(next, { replace: true });
  }, [activeTab, searchParams, setSearchParams]);

  useEffect(() => {
    localStorage.setItem(SERVER_STAGE_STORAGE_KEY, String(serverStageCollapsed));
  }, [serverStageCollapsed]);

  const catalogModels = useMemo(() => buildCatalogModels(servers, models), [servers, models]);
  const reachable = servers.filter((server) => connectivity[server.inference_server.server_id]?.ok).length;
  const selectedServerRows = servers.filter((server) => selectedServers.has(server.inference_server.server_id));

  const runtimeOptions = useMemo(() => Array.from(new Set(servers.map(runtimeLabel))).sort(), [servers]);
  const gpuOptions = useMemo(() => Array.from(new Set(servers.map(gpuLabel))).sort(), [servers]);
  const familyOptions = useMemo(() => Array.from(new Set(catalogModels.filter((model) => selectedServers.has(model.serverId)).map((model) => model.family))).sort(), [catalogModels, selectedServers]);
  const quantizationOptions = useMemo(() => Array.from(new Set(catalogModels.filter((model) => selectedServers.has(model.serverId)).map((model) => model.quantization))).sort(), [catalogModels, selectedServers]);
  const formatOptions = useMemo(() => Array.from(new Set(catalogModels.filter((model) => selectedServers.has(model.serverId)).map((model) => model.format))).sort(), [catalogModels, selectedServers]);

  const filteredServers = useMemo(() => {
    return servers.filter((server) => {
      if (server.inference_server.archived !== showArchivedOnly) return false;
      const status = statusFor(server, connectivity[server.inference_server.server_id]);
      if (serverFilters.status.size && !serverFilters.status.has(status)) return false;
      if (serverFilters.runtime.size && !serverFilters.runtime.has(runtimeLabel(server))) return false;
      if (serverFilters.gpu.size && !serverFilters.gpu.has(gpuLabel(server))) return false;
      return true;
    });
  }, [connectivity, serverFilters, servers, showArchivedOnly]);
  const selectedDetail = filteredServers.find((server) => server.inference_server.server_id === selectedDetailId) ?? null;

  useEffect(() => {
    if (!selectedDetailId || activeTab !== 'servers') return;
    if (filteredServers.some((server) => server.inference_server.server_id === selectedDetailId)) return;
    setSelectedDetailId(null);
  }, [activeTab, filteredServers, selectedDetailId]);

  const visibleModels = useMemo(() => {
    if (selectedServers.size === 0) return [];
    return catalogModels.filter((model) => {
      if (!selectedServers.has(model.serverId)) return false;
      if (selectedFamilies.size && !selectedFamilies.has(model.family)) return false;
      if (selectedQuantizations.size && !selectedQuantizations.has(model.quantization)) return false;
      if (selectedFormats.size && !selectedFormats.has(model.format)) return false;
      return true;
    });
  }, [catalogModels, selectedFamilies, selectedFormats, selectedQuantizations, selectedServers]);

  function updateQuery(mutator: (params: URLSearchParams) => void, replace = false) {
    const next = new URLSearchParams(searchParams);
    mutator(next);
    setSearchParams(next, { replace });
  }

  function toggleServerSelection(serverId: string) {
    const next = toggleSetValue(selectedServers, serverId);
    updateQuery((params) => {
      params.set('tab', 'models');
      writeCsv(params, 'servers', next);
    });
  }

  function toggleModelFilter(key: 'family' | 'quantization' | 'format', value: string) {
    const current = key === 'family' ? selectedFamilies : key === 'quantization' ? selectedQuantizations : selectedFormats;
    const nextSet = toggleSetValue(current, value);
    updateQuery((params) => writeCsv(params, key, nextSet));
  }

  function changeTab(tab: string) {
    updateQuery((params) => {
      params.set('tab', tab);
      params.delete('view');
      params.delete('serverId');
      params.delete('modelId');
    });
  }

  function notifyServersUpdated() {
    window.dispatchEvent(new CustomEvent('inference-servers:updated'));
  }

  async function handleDelete(server: InferenceServerRecord) {
    if (!window.confirm(`Delete inference server "${server.inference_server.display_name}"? This cannot be undone.`)) return;
    await deleteInferenceServer(server.inference_server.server_id);
    setDrawer(null);
    notifyServersUpdated();
    await refreshData();
  }

  if (activeTab === 'models' && inspectorServerId && inspectorModelId) {
    return (
      <>
        <MergedPageHeader
          title="Catalog · Inspect"
          subtitle={`Servers and models · ${reachable} reachable · ${catalogModels.length} models discovered`}
          tabs={[
            { id: 'servers', label: 'Servers', sub: `${servers.length}` },
            { id: 'models', label: 'Models', sub: `${catalogModels.length}` }
          ]}
          activeTab={activeTab}
          onTabChange={changeTab}
        />
        <InferenceContextBar params={inferenceParams} onChange={setInferenceParams} />
        <ModelDetails
          serverId={inspectorServerId}
          modelId={inspectorModelId}
          onBack={() => navigate({ pathname: '/catalog', search: catalogSearch('models') })}
        />
      </>
    );
  }

  return (
    <>
      <MergedPageHeader
        title="Catalog"
        subtitle={`Servers and models · ${reachable} reachable · ${catalogModels.length} models discovered`}
        tabs={[
          { id: 'servers', label: 'Servers', sub: `${servers.length}` },
          { id: 'models', label: 'Models', sub: `${catalogModels.length}` }
        ]}
        activeTab={activeTab}
        onTabChange={changeTab}
      />
      <InferenceContextBar params={inferenceParams} onChange={setInferenceParams} />
      {error ? <div className="catalog-error error">{error}</div> : null}
      {loading ? <p className="catalog-loading muted">Loading catalog...</p> : null}
      {activeTab === 'servers' ? (
        healthView ? (
          <ServersHealthPanel servers={servers} connectivity={connectivity} />
        ) : (
          <ServersCatalog
            servers={filteredServers}
            allServers={servers}
            connectivity={connectivity}
            selectedDetail={selectedDetail}
            selectedDetailId={selectedDetailId}
            runtimeOptions={runtimeOptions}
            gpuOptions={gpuOptions}
            serverFilters={serverFilters}
            serverFiltersOpen={serverFiltersOpen}
            showArchivedOnly={showArchivedOnly}
            setServerFilters={setServerFilters}
            onToggleServerFilters={() => setServerFiltersOpen((current) => !current)}
            onToggleArchivedOnly={() => setShowArchivedOnly((current) => !current)}
            onSelectDetail={setSelectedDetailId}
            onEdit={(server) => setDrawer({ kind: 'edit', server })}
            onArchive={async (server) => {
              if (server.inference_server.archived) {
                await unarchiveInferenceServer(server.inference_server.server_id);
              } else {
                await archiveInferenceServer(server.inference_server.server_id);
              }
              notifyServersUpdated();
              await refreshData();
            }}
            onAdd={() => setDrawer({ kind: 'create' })}
          />
        )
      ) : (
        <ModelsCatalog
          servers={servers}
          selectedServers={selectedServers}
          selectedServerRows={selectedServerRows}
          visibleModels={visibleModels}
          allModelCount={catalogModels.length}
          familyOptions={familyOptions}
          quantizationOptions={quantizationOptions}
          formatOptions={formatOptions}
          selectedFamilies={selectedFamilies}
          selectedQuantizations={selectedQuantizations}
          selectedFormats={selectedFormats}
          serverStageCollapsed={serverStageCollapsed}
          setServerStageCollapsed={setServerStageCollapsed}
          onToggleServer={toggleServerSelection}
          onClearServers={() => updateQuery((params) => {
            params.delete('servers');
            params.delete('family');
            params.delete('quantization');
            params.delete('format');
          })}
          onToggleFilter={toggleModelFilter}
          onClearModelFilters={() => updateQuery((params) => {
            params.delete('family');
            params.delete('quantization');
            params.delete('format');
          })}
          onInspect={(serverId, modelId) => navigate({ pathname: '/catalog', search: catalogSearch('models', { serverId, modelId }) })}
          onReprobe={async (serverId) => {
            await refreshInferenceServerDiscovery(serverId);
            notifyServersUpdated();
            await refreshData();
          }}
        />
      )}
      {drawer ? (
        <ServerDrawer
          mode={drawer}
          onClose={() => setDrawer(null)}
          onDelete={drawer.kind === 'edit' ? () => handleDelete(drawer.server) : undefined}
          onSaved={async (server, openModels) => {
            notifyServersUpdated();
            await refreshData();
            if (openModels) {
              updateQuery((params) => {
                params.set('tab', 'models');
                writeCsv(params, 'servers', [server.inference_server.server_id]);
              });
            }
          }}
        />
      ) : null}
    </>
  );
}

function FilterGroup({ title, options, selected, onToggle }: { title: string; options: string[]; selected: Set<string>; onToggle: (value: string) => void }) {
  return (
    <div className="catalog-filter-group">
      <div className="label--uppercase">{title}</div>
      {options.length === 0 ? <p className="muted">No values</p> : null}
      {options.map((option) => (
        <label key={option} className="catalog-checkbox">
          <input type="checkbox" checked={selected.has(option)} onChange={() => onToggle(option)} />
          <span>{option}</span>
        </label>
      ))}
    </div>
  );
}

function ServersCatalog(props: {
  servers: InferenceServerRecord[];
  allServers: InferenceServerRecord[];
  connectivity: Record<string, InferenceServerHealth>;
  selectedDetail: InferenceServerRecord | null;
  selectedDetailId: string | null;
  runtimeOptions: string[];
  gpuOptions: string[];
  serverFilters: { status: Set<string>; runtime: Set<string>; gpu: Set<string> };
  serverFiltersOpen: boolean;
  showArchivedOnly: boolean;
  setServerFilters: (filters: { status: Set<string>; runtime: Set<string>; gpu: Set<string> }) => void;
  onToggleServerFilters: () => void;
  onToggleArchivedOnly: () => void;
  onSelectDetail: (serverId: string | null) => void;
  onEdit: (server: InferenceServerRecord) => void;
  onArchive: (server: InferenceServerRecord) => void;
  onAdd: () => void;
}) {
  if (props.allServers.length === 0) {
    return <NoServersState onAdd={props.onAdd} />;
  }
  return (
    <section className={`catalog-page catalog-servers ${props.serverFiltersOpen ? 'has-filters' : ''} ${props.selectedDetail ? 'has-detail' : ''}`}>
      {props.serverFiltersOpen ? (
        <aside className="catalog-rail">
          <FilterGroup
            title="Status"
            options={['healthy', 'degraded', 'down', 'unknown']}
            selected={props.serverFilters.status}
            onToggle={(value) => props.setServerFilters({ ...props.serverFilters, status: toggleSetValue(props.serverFilters.status, value) })}
          />
          <FilterGroup
            title="Runtime"
            options={props.runtimeOptions}
            selected={props.serverFilters.runtime}
            onToggle={(value) => props.setServerFilters({ ...props.serverFilters, runtime: toggleSetValue(props.serverFilters.runtime, value) })}
          />
          <FilterGroup
            title="GPU"
            options={props.gpuOptions}
            selected={props.serverFilters.gpu}
            onToggle={(value) => props.setServerFilters({ ...props.serverFilters, gpu: toggleSetValue(props.serverFilters.gpu, value) })}
          />
        </aside>
      ) : null}
      <main className="catalog-main">
        <div className="catalog-section-title">
          <div>
            <h2>Inference servers</h2>
            <p>{props.servers.length} shown · {props.allServers.filter((server) => !server.inference_server.archived).length} active · {props.allServers.filter((server) => server.inference_server.archived).length} archived</p>
          </div>
          <div className="catalog-section-actions">
            <button type="button" className={`btn btn--ghost btn--sm ${props.serverFiltersOpen ? 'is-active' : ''}`} onClick={props.onToggleServerFilters}>Filter</button>
            <button type="button" className={`btn btn--ghost btn--sm ${props.showArchivedOnly ? 'is-active' : ''}`} onClick={props.onToggleArchivedOnly}>Archived</button>
            <button type="button" className="btn btn--sm" onClick={props.onAdd}>+ Add server</button>
          </div>
        </div>
        {props.servers.length === 0 ? (
          <div className="catalog-empty">
            <EmptyState
              title={props.showArchivedOnly ? 'No archived servers' : 'No matching servers'}
              body={props.showArchivedOnly ? 'Archived servers appear here when they are available.' : 'Adjust the server filters to show more entries.'}
            />
          </div>
        ) : (
          <div className="catalog-server-grid">
            {props.servers.map((server) => {
              const status = statusFor(server, props.connectivity[server.inference_server.server_id]);
              return (
                <button
                  type="button"
                  key={server.inference_server.server_id}
                  className={`catalog-server-card ${props.selectedDetailId === server.inference_server.server_id ? 'is-selected' : ''}`}
                  aria-pressed={props.selectedDetailId === server.inference_server.server_id}
                  onClick={() => props.onSelectDetail(props.selectedDetailId === server.inference_server.server_id ? null : server.inference_server.server_id)}
                >
                  <span className="catalog-card-top">
                    <strong>{server.inference_server.display_name}</strong>
                    <RegLight
                      state={statusToRegLight(status)}
                      label={statusLabel(status)}
                      latencyMs={props.connectivity[server.inference_server.server_id]?.response_time_ms}
                      lastProbe={props.connectivity[server.inference_server.server_id]?.checked_at ?? server.discovery.retrieved_at}
                      statusCode={props.connectivity[server.inference_server.server_id]?.status_code}
                      error={props.connectivity[server.inference_server.server_id]?.error}
                    />
                  </span>
                  <span className="catalog-url">{server.endpoints.base_url}</span>
                  <span className="catalog-card-meta">
                    <span>{runtimeLabel(server)}</span>
                    <span className="catalog-pill">{gpuLabel(server)}</span>
                  </span>
                  <span className="catalog-card-footer">
                    <span>{server.discovery.model_list.normalised.length} models</span>
                    <span>{relativeTime(server.discovery.retrieved_at)}</span>
                    <span aria-hidden="true">...</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </main>
      {props.selectedDetail ? (
        <aside className="catalog-detail-rail">
          <div className="panel-header">
            <h3>{props.selectedDetail.inference_server.display_name}</h3>
            <RegLight
              state={statusToRegLight(statusFor(props.selectedDetail, props.connectivity[props.selectedDetail.inference_server.server_id]))}
              label={statusLabel(statusFor(props.selectedDetail, props.connectivity[props.selectedDetail.inference_server.server_id]))}
              compact
              latencyMs={props.connectivity[props.selectedDetail.inference_server.server_id]?.response_time_ms}
              lastProbe={props.connectivity[props.selectedDetail.inference_server.server_id]?.checked_at ?? props.selectedDetail.discovery.retrieved_at}
              statusCode={props.connectivity[props.selectedDetail.inference_server.server_id]?.status_code}
              error={props.connectivity[props.selectedDetail.inference_server.server_id]?.error}
            />
          </div>
          <div className="kv"><span>Base URL</span><strong>{props.selectedDetail.endpoints.base_url}</strong></div>
          <div className="kv"><span>Runtime</span><strong>{runtimeLabel(props.selectedDetail)}</strong></div>
          <div className="kv"><span>GPU</span><strong>{gpuLabel(props.selectedDetail)}</strong></div>
          <div className="kv"><span>Models</span><strong>{props.selectedDetail.discovery.model_list.normalised.length}</strong></div>
          <div className="kv"><span>Last probe</span><strong>{relativeTime(props.selectedDetail.discovery.retrieved_at)}</strong></div>
          <div className="actions">
            <button type="button" className="btn btn--ghost" onClick={() => props.onEdit(props.selectedDetail!)}>Edit</button>
            <button type="button" className="btn btn--ghost" onClick={() => props.onArchive(props.selectedDetail!)}>
              {props.selectedDetail.inference_server.archived ? 'Unarchive' : 'Archive'}
            </button>
          </div>
        </aside>
      ) : null}
    </section>
  );
}

function ModelsCatalog(props: {
  servers: InferenceServerRecord[];
  selectedServers: Set<string>;
  selectedServerRows: InferenceServerRecord[];
  visibleModels: CatalogModel[];
  allModelCount: number;
  familyOptions: string[];
  quantizationOptions: string[];
  formatOptions: string[];
  selectedFamilies: Set<string>;
  selectedQuantizations: Set<string>;
  selectedFormats: Set<string>;
  serverStageCollapsed: boolean;
  setServerStageCollapsed: (value: boolean) => void;
  onToggleServer: (serverId: string) => void;
  onClearServers: () => void;
  onToggleFilter: (key: 'family' | 'quantization' | 'format', value: string) => void;
  onClearModelFilters: () => void;
  onInspect: (serverId: string, modelId: string) => void;
  onReprobe: (serverId: string) => void;
}) {
  const [modelFilterStageCollapsed, setModelFilterStageCollapsed] = useState(() => localStorage.getItem(MODEL_FILTER_STAGE_STORAGE_KEY) === 'true');
  const selectedModelFilterCount = props.selectedFamilies.size + props.selectedQuantizations.size + props.selectedFormats.size;

  useEffect(() => {
    localStorage.setItem(MODEL_FILTER_STAGE_STORAGE_KEY, String(modelFilterStageCollapsed));
  }, [modelFilterStageCollapsed]);

  if (props.servers.length === 0) {
    return <NoServersState />;
  }
  return (
    <section className={`catalog-page catalog-models ${props.serverStageCollapsed && props.selectedServers.size ? 'stage-collapsed' : ''} ${modelFilterStageCollapsed && props.selectedServers.size ? 'filter-collapsed' : ''}`}>
      <aside className="catalog-server-stage">
        {props.serverStageCollapsed && props.selectedServers.size ? (
          <>
            <button type="button" className="catalog-stage-expand" onClick={() => props.setServerStageCollapsed(false)}>›</button>
            <div className="catalog-vertical-label">Servers · {props.selectedServers.size} selected</div>
            <div className="catalog-server-tiles">
              {props.selectedServerRows.map((server) => (
                <button key={server.inference_server.server_id} type="button" title={server.inference_server.display_name} onClick={() => props.onToggleServer(server.inference_server.server_id)}>
                  {server.inference_server.display_name.slice(0, 2).toUpperCase()}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="catalog-stage-number">1</div>
            <div className="catalog-rail-header">
              <div>
                <strong>Servers</strong>
                <span>{props.selectedServers.size} selected</span>
              </div>
              {props.selectedServers.size ? <button type="button" className="btn btn--ghost btn--sm" onClick={props.onClearServers}>Clear</button> : null}
            </div>
            {props.selectedServers.size ? <button type="button" className="btn btn--ghost btn--sm" onClick={() => props.setServerStageCollapsed(true)}>Collapse</button> : null}
            <div className="catalog-server-picker">
              {props.servers.map((server) => (
                <label key={server.inference_server.server_id} className={`server-filter-row ${props.selectedServers.has(server.inference_server.server_id) ? 'is-selected' : ''}`}>
                  <input type="checkbox" checked={props.selectedServers.has(server.inference_server.server_id)} onChange={() => props.onToggleServer(server.inference_server.server_id)} />
                  <span>
                    <strong>{server.inference_server.display_name}</strong>
                    <small>{server.endpoints.base_url}</small>
                    <small>{runtimeLabel(server)} · {gpuLabel(server)}</small>
                  </span>
                  <b>{server.discovery.model_list.normalised.length}</b>
                </label>
              ))}
            </div>
          </>
        )}
      </aside>
      {props.selectedServers.size ? (
        <aside className="catalog-rail catalog-model-filter-stage">
          {modelFilterStageCollapsed ? (
            <>
              <button type="button" className="catalog-stage-expand" onClick={() => setModelFilterStageCollapsed(false)}>›</button>
              <div className="catalog-vertical-label">Models · {selectedModelFilterCount} selected</div>
              <div className="catalog-server-tiles">
                {selectedModelFilterCount ? (
                  [
                    props.selectedFamilies.size ? 'FA' : null,
                    props.selectedQuantizations.size ? 'QU' : null,
                    props.selectedFormats.size ? 'FO' : null
                  ].filter(Boolean).map((label) => (
                    <button key={label} type="button" title={label ?? ''} onClick={() => setModelFilterStageCollapsed(false)}>{label}</button>
                  ))
                ) : (
                  <button type="button" title="All" onClick={() => setModelFilterStageCollapsed(false)}>AL</button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="catalog-stage-number">2</div>
              <div className="catalog-rail-header">
                <div>
                  <strong>Models</strong>
                  <span>{selectedModelFilterCount} selected</span>
                </div>
                {selectedModelFilterCount ? <button type="button" className="btn btn--ghost btn--sm" onClick={props.onClearModelFilters}>Clear</button> : null}
              </div>
              <button type="button" className="btn btn--ghost btn--sm catalog-stage-collapse" onClick={() => setModelFilterStageCollapsed(true)}>Collapse</button>
              <FilterGroup title="Family" options={props.familyOptions} selected={props.selectedFamilies} onToggle={(value) => props.onToggleFilter('family', value)} />
              <FilterGroup title="Quantization" options={props.quantizationOptions} selected={props.selectedQuantizations} onToggle={(value) => props.onToggleFilter('quantization', value)} />
              <FilterGroup title="Format" options={props.formatOptions} selected={props.selectedFormats} onToggle={(value) => props.onToggleFilter('format', value)} />
            </>
          )}
        </aside>
      ) : (
        <aside className="catalog-rail catalog-placeholder">Select a server first</aside>
      )}
      <main className="catalog-main">
        <div className="catalog-section-title">
          <div>
            <h2>Models</h2>
            <p>{props.visibleModels.length} of {props.allModelCount} · {props.selectedServers.size} selected servers</p>
          </div>
        </div>
        {props.selectedServers.size === 0 ? (
          <div className="catalog-empty">
            <EmptyState
              title="Select a server to see its models"
              body="Models are scoped to the servers that host them. Select one or more servers from the rail."
            />
          </div>
        ) : props.visibleModels.length === 0 ? (
          <div className="catalog-empty">
            <EmptyState
              title="No models discovered"
              body={`${props.selectedServerRows.map((server) => server.inference_server.display_name).join(', ')} returned 0 matching models.`}
              actions={props.selectedServerRows[0] ? <button type="button" onClick={() => props.onReprobe(props.selectedServerRows[0].inference_server.server_id)}>Re-probe</button> : null}
            />
          </div>
        ) : (
          <div className="catalog-model-grid">
            {props.visibleModels.map((model) => (
              <article key={model.key} className="catalog-model-card">
                <div className="catalog-card-top">
                  <strong>{model.displayName}</strong>
                  <span className="catalog-select-dot">✓</span>
                </div>
                <div className="catalog-model-pills">
                  <span>{model.family}</span>
                  <span>{model.quantization}</span>
                  <span>{model.format}</span>
                  <span>{model.context}</span>
                </div>
                <p>{[model.tools ? 'tools' : null, model.streaming ? 'streaming' : null].filter(Boolean).join(' · ') || 'standard generation'}</p>
                <div className="catalog-card-footer">
                  <span className="server-chip">{model.serverName}</span>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => props.onInspect(model.serverId, model.modelId)}>Inspect</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </section>
  );
}

function ServersHealthPanel({ servers, connectivity }: { servers: InferenceServerRecord[]; connectivity: Record<string, InferenceServerHealth> }) {
  const counts = servers.reduce<Record<ServerStatus, number>>((acc, server) => {
    acc[statusFor(server, connectivity[server.inference_server.server_id])]++;
    return acc;
  }, { healthy: 0, degraded: 0, down: 0, unknown: 0 });
  return (
    <section className="catalog-page catalog-health">
      <main className="catalog-main">
        <div className="catalog-section-title">
          <div>
            <h2>Servers · health</h2>
            <p>{counts.down} down · {counts.degraded} degraded · {counts.healthy} healthy</p>
          </div>
        </div>
        <div className="health-legend">
          {(['healthy', 'degraded', 'down', 'unknown'] as ServerStatus[]).map((status) => (
            <span key={status}><RegLight state={statusToRegLight(status)} label={status} compact /> {status}</span>
          ))}
        </div>
        <div className="health-tile-grid">
          {servers.map((server) => {
            const health = connectivity[server.inference_server.server_id];
            const status = statusFor(server, health);
            return (
              <div key={server.inference_server.server_id} className="health-tile">
                <RegLight
                  state={statusToRegLight(status)}
                  label={statusLabel(status)}
                  compact
                  latencyMs={health?.response_time_ms}
                  lastProbe={health?.checked_at ?? server.discovery.retrieved_at}
                  statusCode={health?.status_code}
                  error={health?.error}
                />
                <strong>{server.inference_server.display_name}</strong>
              </div>
            );
          })}
        </div>
        <div className="health-table">
          <div className="health-row health-row--head"><span>Server</span><span>Latency</span><span>Last probe</span><span>Status</span></div>
          {servers.map((server) => {
            const health = connectivity[server.inference_server.server_id];
            const status = statusFor(server, health);
            return (
              <div key={server.inference_server.server_id} className="health-row">
                <span>
                  <RegLight
                    state={statusToRegLight(status)}
                    label={statusLabel(status)}
                    compact
                    latencyMs={health?.response_time_ms}
                    lastProbe={health?.checked_at ?? server.discovery.retrieved_at}
                    statusCode={health?.status_code}
                    error={health?.error}
                  />
                  <strong>{server.inference_server.display_name}</strong><small>{server.endpoints.base_url}</small>
                </span>
                <span>{health?.response_time_ms != null ? `${health.response_time_ms}ms` : '-'}</span>
                <span>{relativeTime(health?.checked_at)}</span>
                <span>{health?.status_code ?? statusLabel(status)}</span>
              </div>
            );
          })}
        </div>
      </main>
    </section>
  );
}

function NoServersState({ onAdd }: { onAdd?: () => void }) {
  return (
    <section className="catalog-page catalog-servers">
      <main className="catalog-main catalog-empty catalog-empty-large">
        <EmptyState
          title="No servers yet"
          body="Add an inference server, probe its model endpoint, then use discovered models in tests and evaluations."
          actions={onAdd ? <button type="button" onClick={onAdd}>+ Add server</button> : null}
        />
      </main>
    </section>
  );
}

function ServerDrawer({ mode, onClose, onSaved, onDelete }: {
  mode: DrawerMode;
  onClose: () => void;
  onSaved: (server: InferenceServerRecord, openModels: boolean) => Promise<void>;
  onDelete?: () => void;
}) {
  const editing = mode.kind === 'edit' ? mode.server : null;
  const [displayName, setDisplayName] = useState(editing?.inference_server.display_name ?? '');
  const [baseUrl, setBaseUrl] = useState(editing?.endpoints.base_url ?? '');
  const [software, setSoftware] = useState(editing?.runtime.server_software.name ?? '');
  const [version, setVersion] = useState(editing?.runtime.server_software.version ?? '');
  const [schemaFamilies, setSchemaFamilies] = useState<ApiSchemaFamily[]>(editing?.runtime.api.schema_family ?? ['openai-compatible']);
  const [authType, setAuthType] = useState<'none' | 'bearer' | 'header'>(editing?.auth.type === 'custom' ? 'header' : editing?.auth.type === 'bearer' ? 'bearer' : 'none');
  const [authHeader, setAuthHeader] = useState(editing?.auth.header_name ?? 'Authorization');
  const [authToken, setAuthToken] = useState('');
  const [gpu, setGpu] = useState(editing ? gpuLabel(editing) : '');
  const [busy, setBusy] = useState(false);
  const [probeState, setProbeState] = useState<'idle' | 'probing' | 'ok' | 'failed'>('idle');
  const [probeError, setProbeError] = useState<string | null>(null);
  const [savedServer, setSavedServer] = useState<InferenceServerRecord | null>(null);
  const [discovered, setDiscovered] = useState<string[]>([]);

  function toggleFamily(value: ApiSchemaFamily) {
    setSchemaFamilies((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function buildInput(): InferenceServerInput {
    const authPayload: InferenceServerInput['auth'] = {
      type: authType === 'header' ? 'custom' as AuthType : authType,
      header_name: authHeader || 'Authorization'
    };
    if (authType === 'none') {
      authPayload.token = null;
      authPayload.token_env = null;
    } else if (authToken.trim()) {
      authPayload.token = authToken.trim();
      authPayload.token_env = null;
    }
    return {
      inference_server: { display_name: displayName, active: true, archived: false },
      endpoints: { base_url: baseUrl },
      runtime: {
        server_software: { name: software.trim() || 'unknown', version: version.trim() || null, build: null },
        api: { schema_family: schemaFamilies.length ? schemaFamilies : ['custom'], api_version: null },
        hardware: gpu.trim()
          ? { cpu: { model: null, cores: null }, gpu: [{ vendor: 'unknown', model: gpu.trim(), vram_mb: null }], ram_mb: null }
          : undefined
      },
      auth: authPayload
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setProbeError(null);
    try {
      const input = buildInput();
      const server = editing
        ? await updateInferenceServer(editing.inference_server.server_id, input)
        : await createInferenceServer(input);
      setSavedServer(server);
      setProbeState('probing');
      try {
        const refreshed = await refreshInferenceServerDiscovery(server.inference_server.server_id);
        setDiscovered(refreshed.discovery.model_list.normalised.map((model) => model.model_id));
        setProbeState('ok');
        await onSaved(refreshed, false);
      } catch (err) {
        setProbeState('failed');
        setProbeError(err instanceof Error ? err.message : 'Probe failed');
        await onSaved(server, false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function openInCatalog() {
    if (!savedServer) return;
    await onSaved(savedServer, !editing);
    onClose();
  }

  return (
    <div className="drawer-overlay" role="dialog" aria-modal="true">
      <aside className="server-drawer">
        <div className="drawer-header">
          <div>
            <span className="label--uppercase">{editing ? 'Edit' : 'Add'}</span>
            <h2>{editing ? `Edit · ${editing.inference_server.display_name}` : 'Add inference server'}</h2>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>x</button>
        </div>
        <form onSubmit={handleSubmit} className="drawer-body">
          <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></label>
          <label>Base URL<input className="input--mono" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.example.com" required /></label>
          <div className="drawer-two-col">
            <label>Software<input value={software} onChange={(event) => setSoftware(event.target.value)} placeholder="vLLM" /></label>
            <label>Version<input value={version} onChange={(event) => setVersion(event.target.value)} placeholder="0.6.3" /></label>
          </div>
          <div>
            <div className="form-field-label">API families</div>
            <div className="chip-field">
              {([
                ['openai-compatible', 'OpenAI'],
                ['ollama', 'Ollama'],
                ['custom', 'Custom']
              ] as Array<[ApiSchemaFamily, string]>).map(([value, label]) => (
                <label key={value} className="catalog-checkbox">
                  <input type="checkbox" checked={schemaFamilies.includes(value)} onChange={() => toggleFamily(value)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
          <label>Auth type<select value={authType} onChange={(event) => setAuthType(event.target.value as 'none' | 'bearer' | 'header')}>
            <option value="none">None</option>
            <option value="bearer">Bearer</option>
            <option value="header">Header</option>
          </select></label>
          {authType !== 'none' ? (
            <>
              <label>Auth header name<input value={authHeader} onChange={(event) => setAuthHeader(event.target.value)} /></label>
              <label>Auth token<input type="password" value={authToken} onChange={(event) => setAuthToken(event.target.value)} placeholder={editing?.auth.token_present ? 'Stored token unchanged' : ''} /></label>
            </>
          ) : null}
          <label>GPU<input value={gpu} onChange={(event) => setGpu(event.target.value)} placeholder="A100 80GB" /></label>
          {probeState !== 'idle' ? (
            <div className={`probe-panel probe-panel--${probeState}`}>
              <strong>{probeState === 'probing' ? 'Probing /v1/models...' : probeState === 'ok' ? 'Probe complete' : 'Probe failed'}</strong>
              {probeError ? <p>{probeError}</p> : null}
              {discovered.length ? <ul>{discovered.slice(0, 8).map((model) => <li key={model}>{model}</li>)}</ul> : null}
            </div>
          ) : null}
          <div className="drawer-footer">
            {onDelete ? <button type="button" className="btn btn--danger" onClick={onDelete}>Delete server</button> : <span />}
            <div className="actions">
              <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
              {probeState === 'failed' && savedServer ? <button type="button" className="btn btn--ghost" onClick={openInCatalog}>Save anyway</button> : null}
              {probeState === 'ok' && savedServer ? <button type="button" onClick={openInCatalog}>Save & open in Catalog</button> : <button type="submit" disabled={busy || !displayName || !baseUrl}>{busy ? 'Saving...' : editing ? 'Save & re-probe' : 'Create & test connection'}</button>}
            </div>
          </div>
        </form>
      </aside>
    </div>
  );
}
