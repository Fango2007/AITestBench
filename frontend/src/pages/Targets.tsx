import { useEffect, useMemo, useState } from 'react';

import { TargetCreateForm } from '../components/TargetCreateForm.js';
import { TargetDetails } from '../components/TargetDetails.js';
import { TargetEditForm } from '../components/TargetEditForm.js';
import { TargetErrors } from '../components/TargetErrors.js';
import { TargetList } from '../components/TargetList.js';
import {
  TargetRecord,
  archiveTarget,
  createTarget,
  deleteTarget,
  listTargets,
  probeModelContextWindow,
  retryConnectivity,
  updateTarget
} from '../services/targets-api.js';

type TargetModel = NonNullable<TargetRecord['models']>[number];

export function Targets() {
  const [targets, setTargets] = useState<TargetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TargetRecord | null>(null);
  const [inspecting, setInspecting] = useState<TargetRecord | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modelInspecting, setModelInspecting] = useState<{
    targetId: string;
    model: TargetModel;
  } | null>(null);
  const [modelProbeState, setModelProbeState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [modelProbeError, setModelProbeError] = useState<string | null>(null);

  function notifyTargetsUpdated() {
    window.dispatchEvent(new CustomEvent('targets:updated'));
  }

  async function refreshTargets() {
    setLoading(true);
    setError(null);
    const currentInspectId = inspecting?.id ?? null;
    try {
      const data = await listTargets('all');
      setTargets(data);
      if (currentInspectId) {
        const refreshed = data.find((target) => target.id === currentInspectId) ?? null;
        setInspecting(refreshed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load targets');
      setTargets([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshTargets();
    const intervalId = window.setInterval(() => {
      refreshTargets();
    }, 8000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const probe = async () => {
      if (!modelInspecting) {
        return;
      }
      if (!modelInspecting.targetId) {
        return;
      }
      if (modelInspecting.model.context_window) {
        setModelProbeState('idle');
        setModelProbeError(null);
        return;
      }
      setModelProbeState('loading');
      setModelProbeError(null);
      try {
        const response = await probeModelContextWindow(
          modelInspecting.targetId,
          modelInspecting.model.model_id
        );
        await refreshTargets();
        setModelInspecting((prev) =>
          prev ? { ...prev, model: response.model } : prev
        );
        setModelProbeState('idle');
      } catch (err) {
        setModelProbeError(err instanceof Error ? err.message : 'Unable to probe context window');
        setModelProbeState('error');
      }
    };
    probe();
  }, [modelInspecting]);

  async function handleCreate(input: Parameters<typeof createTarget>[0]) {
    setError(null);
    try {
      await createTarget(input);
      await refreshTargets();
      notifyTargetsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create target');
    }
  }

  async function handleEditSave(updates: Parameters<typeof updateTarget>[1]) {
    if (!editing) {
      return;
    }
    setError(null);
    try {
      await updateTarget(editing.id, updates);
      setEditing(null);
      await refreshTargets();
      notifyTargetsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update target');
    }
  }

  async function handleArchive(target: TargetRecord) {
    setError(null);
    try {
      await archiveTarget(target.id);
      await refreshTargets();
      notifyTargetsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to archive target');
    }
  }

  async function handleDelete(target: TargetRecord) {
    const confirmed = window.confirm(`Delete target \"${target.name}\"?`);
    if (!confirmed) {
      return;
    }
    setError(null);
    try {
      await deleteTarget(target.id);
      await refreshTargets();
      notifyTargetsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete target');
    }
  }

  async function handleRetry(target: TargetRecord) {
    setError(null);
    try {
      await retryConnectivity(target.id);
      await refreshTargets();
      notifyTargetsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to retry connectivity');
    }
  }

  const activeTargets = targets.filter((target) => target.status === 'active');
  const archivedTargets = targets.filter((target) => target.status === 'archived');
  const inspectedModels = inspecting?.models ?? [];
  const modelCountLabel = inspectedModels.length ? `(${inspectedModels.length})` : '';

  const serverStatusLabel = (status: TargetRecord['connectivity_status']) => {
    if (status === 'ok') {
      return 'Online';
    }
    if (status === 'failed') {
      return 'Offline';
    }
    return 'Pending';
  };

  const formatBytes = (value?: number | null) => {
    if (!value || value <= 0) {
      return 'N/A';
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const scaled = value / Math.pow(1024, index);
    return `${scaled.toFixed(index >= 2 ? 1 : 0)} ${units[index]}`;
  };

  const streamingSupport = useMemo(() => {
    if (!inspectedModels.length) {
      return 'Unknown';
    }
    const anyStreaming = inspectedModels.some((model) => model.capabilities?.chat);
    return anyStreaming ? 'Supported' : 'Unknown';
  }, [inspectedModels]);

  return (
    <section className="page targets-page">
      <div className="page-header" />
      <TargetErrors message={error} />
      {loading ? <p className="muted">Loading targets…</p> : null}
      <div className="targets-layout">
        <div className="targets-panel">
          <div className="panel-header">
            <h3>Inference Servers</h3>
            <button
              type="button"
              className="icon-button"
              onClick={() => setShowCreateModal(true)}
              aria-label="Add inference server"
              title="Add server"
            >
              <span aria-hidden="true">+</span>
            </button>
          </div>
          <TargetList
            title="Active"
            targets={activeTargets}
            onEdit={(target) => setEditing(target)}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onRetry={handleRetry}
            onInspect={(target) => setInspecting(target)}
            selectedId={inspecting?.id ?? null}
          />
          <TargetList
            title="Archived"
            targets={archivedTargets}
            onEdit={(target) => setEditing(target)}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onRetry={handleRetry}
            onInspect={(target) => setInspecting(target)}
            selectedId={inspecting?.id ?? null}
          />
        </div>
        <div className="details-panel">
          <TargetDetails
            target={inspecting}
            statusLabel={serverStatusLabel}
            streamingSupport={streamingSupport}
          />
        </div>
        <div className="models-panel">
          <div className="card">
            <div className="panel-header">
              <h3>Models on this server {modelCountLabel}</h3>
            </div>
            {inspectedModels.length ? (
              <div className="models-table">
                <div className="models-row models-header">
                  <span>Name</span>
                  <span>Context</span>
                  <span>Quant</span>
                  <span>Size</span>
                  <span>Type</span>
                  <span>Actions</span>
                </div>
                {inspectedModels.map((model) => {
                  const name = model.model_id ?? model.api_model_name ?? 'unknown';
                  const context = model.context_window ? `${model.context_window}` : 'N/A';
                  const quant = model.quantization ?? 'N/A';
                  const size = formatBytes(model.artifacts?.size_bytes ?? null);
                  const type = model.capabilities?.vision ? 'vision' : 'text';
                  return (
                    <div key={`${model.source}-${name}`} className="models-row">
                      <span>{name}</span>
                      <span>{context}</span>
                      <span>{quant}</span>
                      <span>{size}</span>
                      <span>{type}</span>
                      <span className="models-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => setModelInspecting({ targetId: inspecting?.id ?? '', model })}
                          aria-label={`Inspect ${name}`}
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
                        <button type="button" className="icon-button" disabled title="Set default">
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              d="M12 3l3 6 6 .8-4.4 4.3 1 6-5.6-3-5.6 3 1-6L3 9.8 9 9l3-6z"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.2"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                        <button type="button" className="icon-button" disabled title="Run tests">
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              d="M8 5l11 7-11 7V5z"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="muted">Select a server to view models.</p>
            )}
          </div>
        </div>
      </div>
      {showCreateModal ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Add inference server</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowCreateModal(false)}
                aria-label="Close"
              >
                <span aria-hidden="true">x</span>
              </button>
            </div>
            <TargetCreateForm
              onCreate={async (input) => {
                await handleCreate(input);
                setShowCreateModal(false);
              }}
              disabled={loading}
            />
          </div>
        </div>
      ) : null}
      {editing ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Edit inference server</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setEditing(null)}
                aria-label="Close"
              >
                <span aria-hidden="true">x</span>
              </button>
            </div>
            <TargetEditForm
              target={editing}
              onSave={async (updates) => {
                await handleEditSave(updates);
                setEditing(null);
              }}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      ) : null}
      {modelInspecting ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Model inspector</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setModelInspecting(null)}
                aria-label="Close"
              >
                <span aria-hidden="true">x</span>
              </button>
            </div>
            <div className="detail-row">
              <span>Model</span>
              <strong>{modelInspecting.model.model_id ?? modelInspecting.model.api_model_name}</strong>
            </div>
            <div className="detail-row">
              <span>Observed at</span>
              <strong>{inspecting?.last_check_at ?? 'Unknown'}</strong>
            </div>
            <div className="detail-row">
              <span>Source</span>
              <strong>{modelInspecting.model.source}</strong>
            </div>
            <div className="detail-row">
              <span>Parameters</span>
              <strong>{modelInspecting.model.parameter_count ?? 'Unknown'}</strong>
            </div>
            <div className="detail-row">
              <span>Quantization</span>
              <strong>{modelInspecting.model.quantization ?? 'Unknown'}</strong>
            </div>
            <div className="detail-row">
              <span>Context window</span>
              <strong>
                {modelProbeState === 'loading'
                  ? 'Probing…'
                  : modelInspecting.model.context_window ?? 'Unknown'}
              </strong>
            </div>
            <div className="detail-row">
              <span>Artifact size</span>
              <strong>{formatBytes(modelInspecting.model.artifacts?.size_bytes ?? null)}</strong>
            </div>
            <div className="detail-row">
              <span>Digest</span>
              <strong>{modelInspecting.model.artifacts?.digest ?? 'Unknown'}</strong>
            </div>
            {modelProbeState === 'error' ? (
              <p className="error">{modelProbeError}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
