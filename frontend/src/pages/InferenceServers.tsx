import { useEffect, useMemo, useRef, useState } from 'react';

import { InferenceServerCreateForm } from '../components/InferenceServerCreateForm.js';
import { InferenceServerDetails } from '../components/InferenceServerDetails.js';
import { InferenceServerEditForm } from '../components/InferenceServerEditForm.js';
import { InferenceServerErrors } from '../components/InferenceServerErrors.js';
import { InferenceServerHealth, getConnectivityConfig, getInferenceServerHealth } from '../services/connectivity-api.js';
import {
  InferenceServerInput,
  InferenceServerRecord,
  archiveInferenceServer,
  createInferenceServer,
  deleteInferenceServer,
  listInferenceServers,
  refreshInferenceServerDiscovery,
  refreshInferenceServerRuntime,
  unarchiveInferenceServer,
  updateInferenceServer
} from '../services/inference-servers-api.js';

export function InferenceServers() {
  const [servers, setServers] = useState<InferenceServerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<InferenceServerRecord | null>(null);
  const [inspectingId, setInspectingId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connectivity, setConnectivity] = useState<Record<string, InferenceServerHealth>>({});
  const discoveryPollingRef = useRef(false);

  function notifyServersUpdated() {
    window.dispatchEvent(new CustomEvent('inference-servers:updated'));
  }

  async function refreshServers(showLoading = false) {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);
    const currentInspectId = inspectingId;
    try {
      const data = await listInferenceServers();
      setServers(data);
      if (currentInspectId && data.some((server) => server.inference_server.server_id === currentInspectId)) {
        setInspectingId(currentInspectId);
      } else {
        setInspectingId(data[0]?.inference_server.server_id ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load inference servers');
      setServers([]);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    refreshServers(true);
    const intervalId = window.setInterval(() => {
      refreshServers(false);
    }, 10000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    let intervalId: number | null = null;

    const fetchHealth = async () => {
      try {
        const results = await getInferenceServerHealth();
        if (!isActive) {
          return;
        }
        const nextMap: Record<string, InferenceServerHealth> = {};
        for (const entry of results) {
          nextMap[entry.server_id] = entry;
        }
        setConnectivity(nextMap);
      } catch {
        if (isActive) {
          setConnectivity({});
        }
      }
    };

    const setup = async () => {
      try {
        const config = await getConnectivityConfig();
        const interval = Math.max(1000, config.poll_interval_ms);
        await fetchHealth();
        intervalId = window.setInterval(fetchHealth, interval);
      } catch {
        await fetchHealth();
        intervalId = window.setInterval(fetchHealth, 30000);
      }
    };

    setup();
    return () => {
      isActive = false;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  useEffect(() => {
    if (servers.length === 0) {
      setShowCreateModal(false);
    }
  }, [servers.length]);

  useEffect(() => {
    if (!inspectingId) {
      return;
    }
    let isActive = true;
    const pollDiscovery = async () => {
      if (discoveryPollingRef.current) {
        return;
      }
      discoveryPollingRef.current = true;
      try {
        await refreshInferenceServerDiscovery(inspectingId);
        if (isActive) {
          await refreshServers();
        }
      } catch {
        // Ignore polling failures.
      } finally {
        discoveryPollingRef.current = false;
      }
    };

    pollDiscovery();
    const intervalId = window.setInterval(pollDiscovery, 30000);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [inspectingId]);

  async function handleCreate(input: InferenceServerInput) {
    setError(null);
    try {
      await createInferenceServer(input);
      await refreshServers();
      notifyServersUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create inference server');
    }
  }

  async function handleEditSave(updates: InferenceServerInput) {
    if (!editing) {
      return;
    }
    setError(null);
    try {
      await updateInferenceServer(editing.inference_server.server_id, updates);
      setEditing(null);
      await refreshServers();
      notifyServersUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update inference server');
    }
  }

  async function handleArchive(server: InferenceServerRecord) {
    setError(null);
    try {
      await archiveInferenceServer(server.inference_server.server_id);
      await refreshServers();
      notifyServersUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to archive inference server');
    }
  }

  async function handleUnarchive(server: InferenceServerRecord) {
    setError(null);
    try {
      await unarchiveInferenceServer(server.inference_server.server_id);
      await refreshServers();
      notifyServersUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to unarchive inference server');
    }
  }

  async function handleDelete(server: InferenceServerRecord) {
    const confirmed = window.confirm(
      `Delete inference server "${server.inference_server.display_name}"? This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }
    setError(null);
    try {
      await deleteInferenceServer(server.inference_server.server_id);
      if (inspectingId === server.inference_server.server_id) {
        setInspectingId(null);
      }
      await refreshServers();
      notifyServersUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete inference server');
    }
  }

  async function handleRefreshRuntime() {
    if (!inspectingId) {
      return;
    }
    setError(null);
    setRefreshing(true);
    try {
      await refreshInferenceServerRuntime(inspectingId);
      await refreshServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to refresh runtime');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRefreshDiscovery() {
    if (!inspectingId) {
      return;
    }
    setError(null);
    setRefreshing(true);
    try {
      await refreshInferenceServerDiscovery(inspectingId);
      await refreshServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to refresh discovery');
    } finally {
      setRefreshing(false);
    }
  }

  const inspecting =
    servers.find((server) => server.inference_server.server_id === inspectingId) ?? null;
  const hasServers = servers.length > 0;
  const refreshEnabled = inspectingId ? Boolean(connectivity[inspectingId]?.ok) : false;
  return (
    <section className="page targets-page">
      <div className="page-header servers-header">
        <h2>Inference servers</h2>
        {hasServers ? (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            aria-label="Add inference server"
            title="Add server"
          >
            Add inference server
          </button>
        ) : null}
      </div>
      <InferenceServerErrors message={error} />
      {loading ? <p className="muted">Loading inference servers…</p> : null}
      <div className="details-panel">
        {hasServers ? (
          <InferenceServerDetails
            servers={servers}
            selectedId={inspectingId}
            onSelect={setInspectingId}
            server={inspecting}
            onRefreshRuntime={handleRefreshRuntime}
            onRefreshDiscovery={handleRefreshDiscovery}
            onEdit={(server) => setEditing(server)}
            onArchive={(server) =>
              server.inference_server.archived ? handleUnarchive(server) : handleArchive(server)
            }
            onDelete={handleDelete}
            refreshEnabled={refreshEnabled}
            busy={refreshing}
          />
        ) : (
          <div className="card">
            <div className="panel-header">
              <h3>Add inference server</h3>
            </div>
            <InferenceServerCreateForm
              onCreate={handleCreate}
              disabled={loading}
            />
          </div>
        )}
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
            <InferenceServerCreateForm
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
            <InferenceServerEditForm
              server={editing}
              onSave={async (updates) => {
                await handleEditSave(updates);
                setEditing(null);
              }}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
