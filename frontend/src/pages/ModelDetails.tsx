import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ArchitectureLayerNode, ArchitectureTree, getArchitecture, inspectArchitecture, patchSettings } from '../services/architecture-api.js';
import { ModelRecord, listModels } from '../services/models-api.js';
import { InferenceServerRecord, listInferenceServers } from '../services/inference-servers-api.js';
import { ArchitectureTreeView, formatParams } from '../components/ArchitectureTree.js';

const HF_MODEL_ID_RE = /^\/?[a-zA-Z0-9][a-zA-Z0-9._-]*\/[a-zA-Z0-9][a-zA-Z0-9._-]+$/;
const LOCAL_PATH_KEYS = ['model_path', 'modelPath', 'local_path', 'localPath', 'file_path', 'filePath', 'path'];

function localPathHint(record: ModelRecord): string | null {
  const raw = record.raw ?? {};
  const nestedModel = raw.model && typeof raw.model === 'object' ? (raw.model as Record<string, unknown>) : undefined;
  for (const source of [raw, nestedModel]) {
    if (!source) continue;
    for (const key of LOCAL_PATH_KEYS) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return null;
}

function isInspectable(record: ModelRecord | null, modelId: string): boolean {
  if (!record) return HF_MODEL_ID_RE.test(modelId);
  if (record.architecture.format === 'GGUF') return Boolean(localPathHint(record));
  if (record.architecture.format === 'MLX') return HF_MODEL_ID_RE.test(modelId) || Boolean(localPathHint(record));
  if (record.architecture.format === 'SafeTensors') return HF_MODEL_ID_RE.test(modelId) || Boolean(localPathHint(record));
  if (record.architecture.format === 'GPTQ' || record.architecture.format === 'AWQ') return HF_MODEL_ID_RE.test(modelId) || Boolean(localPathHint(record));
  return HF_MODEL_ID_RE.test(modelId);
}

function inspectionErrorFrom(err: unknown): { code: string; message: string } {
  if (err && typeof err === 'object') {
    const maybeError = err as { code?: unknown; error?: unknown; message?: unknown };
    const code = typeof maybeError.code === 'string' && maybeError.code.trim() ? maybeError.code.trim() : 'unknown';
    const message = [maybeError.error, maybeError.message].find((value) => typeof value === 'string' && value.trim()) as string | undefined;
    return { code, message: message?.trim() ?? 'Architecture inspection failed.' };
  }
  if (err instanceof Error && err.message.trim()) return { code: 'unknown', message: err.message.trim() };
  return { code: 'unknown', message: 'Architecture inspection failed.' };
}

function findNodeByPath(root: ArchitectureLayerNode, path: string | null): ArchitectureLayerNode {
  if (!path) return root;
  const parts = path.split('.').filter(Boolean);
  let node = root;
  for (const part of parts) {
    const next = node.children.find((child) => child.name === part) ?? node.children[Number(part)];
    if (!next) return node;
    node = next;
  }
  return node;
}

interface ModelDetailsProps {
  serverId: string;
  modelId: string;
  onBack: () => void;
}

type InspectionState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; tree: ArchitectureTree }
  | { status: 'error'; code: string; message: string };

export function ModelDetails({ serverId, modelId, onBack }: ModelDetailsProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [record, setRecord] = useState<ModelRecord | null>(null);
  const [server, setServer] = useState<InferenceServerRecord | null>(null);
  const [inspection, setInspection] = useState<InspectionState>({ status: 'idle' });
  const [showTrustSection, setShowTrustSection] = useState(false);
  const [trustBusy, setTrustBusy] = useState(false);
  const [trustEnabled, setTrustEnabled] = useState(false);
  const [sideTab, setSideTab] = useState<'config' | 'tokenizer' | 'runs' | 'readme'>('config');

  const focusPath = searchParams.get('focus');

  useEffect(() => {
    Promise.all([listModels(), listInferenceServers()])
      .then(([records, servers]) => {
        setRecord(records.find((r) => r.model.server_id === serverId && r.model.model_id === modelId) ?? null);
        setServer(servers.find((candidate) => candidate.inference_server.server_id === serverId) ?? null);
      })
      .catch(() => {
        setRecord(null);
        setServer(null);
      });
  }, [serverId, modelId]);

  useEffect(() => {
    let active = true;
    setInspection({ status: 'loading' });
    getArchitecture(serverId, modelId)
      .catch(() => inspectArchitecture(serverId, modelId))
      .then((tree) => {
        if (active) setInspection({ status: 'done', tree });
      })
      .catch((err) => {
        if (!active) return;
        const apiErr = inspectionErrorFrom(err);
        if (apiErr.code === 'unregistered_architecture') setShowTrustSection(true);
        setInspection({ status: 'error', code: apiErr.code, message: apiErr.message });
      });
    return () => {
      active = false;
    };
  }, [serverId, modelId]);

  async function handleInspect() {
    setInspection({ status: 'loading' });
    setShowTrustSection(false);
    try {
      const tree = await inspectArchitecture(serverId, modelId);
      setInspection({ status: 'done', tree });
    } catch (err) {
      const apiErr = inspectionErrorFrom(err);
      if (apiErr.code === 'unregistered_architecture') setShowTrustSection(true);
      setInspection({ status: 'error', code: apiErr.code, message: apiErr.message });
    }
  }

  async function handleEnableTrust() {
    setTrustBusy(true);
    try {
      await patchSettings(serverId, modelId, { trust_remote_code: true });
      setTrustEnabled(true);
    } finally {
      setTrustBusy(false);
    }
  }

  const inspectable = isInspectable(record, modelId);
  const displayName = record?.model.base_model_name ?? record?.model.display_name ?? modelId;
  const tree = inspection.status === 'done' ? inspection.tree : null;
  const focusedNode = useMemo(() => tree ? findNodeByPath(tree.root, focusPath) : null, [tree, focusPath]);
  const stats = [
    ['Params', tree ? formatParams(tree.summary.total_parameters) : record?.architecture.parameter_count ? formatParams(record.architecture.parameter_count) : 'N/A'],
    ['Trainable', tree ? formatParams(tree.summary.trainable_parameters) : 'N/A'],
    ['Layers', tree ? String(tree.summary.by_type.reduce((sum, entry) => sum + entry.count, 0)) : 'N/A'],
    ['Hidden', 'N/A'],
    ['Vocab', 'N/A'],
    ['Format', record?.architecture.format ?? tree?.format ?? 'N/A']
  ];

  function updateFocus(path: string) {
    const next = new URLSearchParams(searchParams);
    next.set('focus', path);
    setSearchParams(next);
  }

  return (
    <section className="model-inspector">
      <header className="model-inspector-header">
        <div className="model-inspector-topline">
          <button type="button" className="btn btn--ghost" onClick={onBack}>← Back to Catalog</button>
          <span className="label--uppercase">Model · Inspect</span>
        </div>
        <div className="model-inspector-title">
          <h2>{displayName}</h2>
          <span className="server-chip">{server?.inference_server.display_name ?? serverId}</span>
        </div>
        <div className="model-inspector-stats">
          {stats.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
          {inspectable ? <button type="button" onClick={handleInspect}>Inspect Architecture</button> : null}
          <button type="button" onClick={() => navigate(`/run?serverId=${encodeURIComponent(serverId)}&modelId=${encodeURIComponent(modelId)}`)}>Run a test</button>
        </div>
        <div className="model-inspector-path">
          <span>path:</span>
          <button type="button" onClick={() => updateFocus('')}>{'<root>'}</button>
          {focusPath ? <strong>{focusPath}</strong> : null}
        </div>
      </header>

      {!inspectable ? (
        <div className="catalog-empty">
          <h3>Architecture inspection is not available</h3>
          <p>This model needs a Hugging Face-style ID or a local path hint before it can be inspected.</p>
        </div>
      ) : inspection.status === 'loading' ? (
        <div className="catalog-empty"><h3>Inspecting architecture...</h3><p>This may take up to 30 seconds.</p></div>
      ) : inspection.status === 'error' ? (
        <div className="error model-inspector-error">
          <strong>Architecture inspection failed.</strong>
          <p>{inspection.code === 'hf_token_required' ? 'This model requires a Hugging Face API token. Add your token in Settings → Environment.' : inspection.message}</p>
          {inspection.code !== 'unknown' ? <p className="muted">Error code: {inspection.code}</p> : null}
          <div className="actions">
            <button type="button" onClick={handleInspect}>Retry</button>
          </div>
          {showTrustSection ? (
            <label className="checkbox">
              <input type="checkbox" checked={trustEnabled} disabled={trustBusy} onChange={async (event) => {
                if (event.target.checked) await handleEnableTrust();
              }} />
              Allow remote code execution for this model
            </label>
          ) : null}
        </div>
      ) : tree ? (
        <div className="model-inspector-grid">
          <aside className="model-inspector-tree">
            <ArchitectureTreeView
              root={tree.root}
              summary={tree.summary}
              accuracy={tree.accuracy}
              inspectionMethod={tree.inspection_method}
              warnings={tree.warnings}
            />
          </aside>
          <main className="model-inspector-detail">
            <span className="label--uppercase">{focusedNode?.type ?? 'Root'} · selected node</span>
            <h3>{focusedNode?.name || '<root>'}</h3>
            <div className="model-node-stats">
              <div><span>Parameters</span><strong>{focusedNode ? formatParams(focusedNode.parameters) : 'N/A'}</strong></div>
              <div><span>Shape</span><strong>{focusedNode?.shape ? `[${focusedNode.shape.join(' x ')}]` : 'N/A'}</strong></div>
              <div><span>Trainable</span><strong>{focusedNode?.trainable ? 'yes' : 'no'}</strong></div>
              <div><span>Children</span><strong>{focusedNode?.children.length ?? 0}</strong></div>
            </div>
            <div className="details-grid">
              <div className="detail-row"><span>Model ID</span><strong>{modelId}</strong></div>
              <div className="detail-row"><span>Server</span><strong>{server?.endpoints.base_url ?? serverId}</strong></div>
              <div className="detail-row"><span>Provider</span><strong>{record?.identity.provider ?? 'unknown'}</strong></div>
              <div className="detail-row"><span>Quantization</span><strong>{record?.architecture.quantisation.weight_format ?? record?.architecture.quantisation.method ?? 'unknown'}</strong></div>
            </div>
          </main>
          <aside className="model-inspector-side">
            <div className="details-tabs">
              {(['config', 'tokenizer', 'runs', 'readme'] as const).map((tab) => (
                <button key={tab} type="button" className={sideTab === tab ? 'active' : undefined} onClick={() => setSideTab(tab)}>
                  <span className="details-tab-name">{tab === 'config' ? 'Config JSON' : tab}</span>
                </button>
              ))}
            </div>
            {sideTab === 'config' ? (
              <pre className="code-block">{JSON.stringify({ record, architecture: tree }, null, 2)}</pre>
            ) : (
              <div className="catalog-empty">
                <h3>{sideTab}</h3>
                <p>No {sideTab} data is available for this model yet.</p>
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </section>
  );
}
