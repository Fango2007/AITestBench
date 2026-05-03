import { useEffect, useState } from 'react';

import { ArchitectureTree, ApiError, inspectArchitecture, patchSettings } from '../services/architecture-api.js';
import { ModelRecord, listModels } from '../services/models-api.js';
import { ArchitectureTreeView } from '../components/ArchitectureTree.js';

const HF_MODEL_ID_RE = /^\/?[a-zA-Z0-9][a-zA-Z0-9._-]*\/[a-zA-Z0-9][a-zA-Z0-9._-]+$/;
const LOCAL_PATH_KEYS = ['model_path', 'modelPath', 'local_path', 'localPath', 'file_path', 'filePath', 'path'];

function isInspectable(record: ModelRecord | null, modelId: string): boolean {
  if (!record) return HF_MODEL_ID_RE.test(modelId);
  if (record.architecture.format === 'GGUF') return Boolean(localPathHint(record));
  if (record.architecture.format === 'MLX') return HF_MODEL_ID_RE.test(modelId) || Boolean(localPathHint(record));
  if (record.architecture.format === 'SafeTensors') return HF_MODEL_ID_RE.test(modelId) || Boolean(localPathHint(record));
  if (record.architecture.format === 'GPTQ' || record.architecture.format === 'AWQ') {
    return HF_MODEL_ID_RE.test(modelId) || Boolean(localPathHint(record));
  }
  return HF_MODEL_ID_RE.test(modelId);
}

function localPathHint(record: ModelRecord): string | null {
  const raw = record.raw ?? {};
  const nestedModel = raw.model && typeof raw.model === 'object' ? (raw.model as Record<string, unknown>) : undefined;
  for (const source of [raw, nestedModel]) {
    if (!source) continue;
    for (const key of LOCAL_PATH_KEYS) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
  }
  return null;
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
  const [record, setRecord] = useState<ModelRecord | null>(null);
  const [inspection, setInspection] = useState<InspectionState>({ status: 'idle' });
  const [showTrustSection, setShowTrustSection] = useState(false);
  const [trustBusy, setTrustBusy] = useState(false);
  const [trustEnabled, setTrustEnabled] = useState(false);

  useEffect(() => {
    listModels()
      .then((records) => {
        const found = records.find((r) => r.model.server_id === serverId && r.model.model_id === modelId);
        setRecord(found ?? null);
      })
      .catch(() => setRecord(null));
  }, [serverId, modelId]);

  async function handleInspect() {
    setInspection({ status: 'loading' });
    setShowTrustSection(false);
    try {
      const tree = await inspectArchitecture(serverId, modelId);
      setInspection({ status: 'done', tree });
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.code === 'unregistered_architecture') {
        setShowTrustSection(true);
      }
      setInspection({ status: 'error', code: apiErr.code ?? 'unknown', message: apiErr.error ?? 'Inspection failed.' });
    }
  }

  async function handleEnableTrust() {
    setTrustBusy(true);
    try {
      await patchSettings(serverId, modelId, { trust_remote_code: true });
      setTrustEnabled(true);
    } catch {
      // ignore
    } finally {
      setTrustBusy(false);
    }
  }

  const inspectable = isInspectable(record, modelId);
  const displayName = record?.model.base_model_name ?? record?.model.display_name ?? modelId;
  const format = record?.architecture.format ?? null;

  return (
    <section className="page">
      <div className="page-header">
        <button type="button" className="icon-button" onClick={onBack} aria-label="Back to models">
          ← Back
        </button>
        <h2>{displayName}</h2>
        {format ? <span className="badge">{format}</span> : null}
      </div>

      <div className="card">
        <div className="details-grid">
          <div className="detail-row">
            <span>Model ID</span>
            <strong>{modelId}</strong>
          </div>
          <div className="detail-row">
            <span>Server</span>
            <strong>{serverId}</strong>
          </div>
          {record ? (
            <>
              <div className="detail-row">
                <span>Provider</span>
                <strong>{record.identity.provider}</strong>
              </div>
              {format ? (
                <div className="detail-row">
                  <span>Format</span>
                  <strong>{format}</strong>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {inspectable ? (
        <div className="card">
          <div className="panel-header">
            <h3>Architecture</h3>
          </div>

          {inspection.status === 'idle' || inspection.status === 'done' ? (
            <div className="actions">
              <button type="button" onClick={handleInspect}>
                Inspect Architecture
              </button>
            </div>
          ) : null}

          {inspection.status === 'loading' ? (
            <p className="muted">Inspecting architecture… (this may take up to 30 s)</p>
          ) : null}

          {inspection.status === 'error' ? (
            <div className="error">
              {inspection.code === 'hf_token_required'
                ? 'This model requires a Hugging Face API token. Add your token in Settings → Environment.'
                : inspection.message}
              <div className="actions" style={{ marginTop: '0.5rem' }}>
                <button type="button" onClick={handleInspect}>
                  Retry
                </button>
              </div>
            </div>
          ) : null}

          {showTrustSection ? (
            <div className="card" style={{ marginTop: '1rem' }}>
              <h4>Architecture Settings</h4>
              <p className="muted">
                This will execute Python code from the model&rsquo;s Hugging Face repository.
              </p>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={trustEnabled}
                  disabled={trustBusy}
                  onChange={async (e) => {
                    if (e.target.checked) {
                      await handleEnableTrust();
                    }
                  }}
                />
                Allow remote code execution
              </label>
              {trustEnabled ? (
                <div className="actions" style={{ marginTop: '0.5rem' }}>
                  <button type="button" onClick={handleInspect}>
                    Inspect Architecture
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {inspection.status === 'done' ? (
            <ArchitectureTreeView
              root={inspection.tree.root}
              summary={inspection.tree.summary}
              accuracy={inspection.tree.accuracy}
              inspectionMethod={inspection.tree.inspection_method}
              warnings={inspection.tree.warnings}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
