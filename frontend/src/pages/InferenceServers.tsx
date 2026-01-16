import { useEffect, useMemo, useRef, useState } from 'react';

import { InferenceServerCreateForm } from '../components/InferenceServerCreateForm.js';
import { InferenceServerDetails } from '../components/InferenceServerDetails.js';
import { InferenceServerEditForm } from '../components/InferenceServerEditForm.js';
import { InferenceServerErrors } from '../components/InferenceServerErrors.js';
import { InferenceServerList } from '../components/InferenceServerList.js';
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

  const activeServers = servers.filter((server) => !server.inference_server.archived);
  const archivedServers = servers.filter((server) => server.inference_server.archived);
  const inspecting =
    servers.find((server) => server.inference_server.server_id === inspectingId) ?? null;
  return (
    <section className="page targets-page">
      <div className="page-header" />
      <InferenceServerErrors message={error} />
      {loading ? <p className="muted">Loading inference servers…</p> : null}
      <div className="targets-grid">
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
          <InferenceServerList
            title="Active"
            servers={activeServers}
            onEdit={(server) => setEditing(server)}
            onArchive={handleArchive}
            onUnarchive={handleUnarchive}
            onDelete={handleDelete}
            onInspect={(server) => setInspectingId(server.inference_server.server_id)}
            selectedId={inspecting?.inference_server.server_id ?? null}
          />
          <InferenceServerList
            title="Archived"
            servers={archivedServers}
            onEdit={(server) => setEditing(server)}
            onArchive={handleArchive}
            onUnarchive={handleUnarchive}
            onDelete={handleDelete}
            onInspect={(server) => setInspectingId(server.inference_server.server_id)}
            selectedId={inspecting?.inference_server.server_id ?? null}
          />
        </div>
        <div className="details-panel">
          <InferenceServerDetails
            servers={servers}
            selectedId={inspectingId}
            onSelect={setInspectingId}
            server={inspecting}
            onRefreshRuntime={handleRefreshRuntime}
            onRefreshDiscovery={handleRefreshDiscovery}
            busy={refreshing}
          />
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
