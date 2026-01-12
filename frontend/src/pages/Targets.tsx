import { useEffect, useState } from 'react';

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
  retryConnectivity,
  updateTarget
} from '../services/targets-api.js';

export function Targets() {
  const [targets, setTargets] = useState<TargetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TargetRecord | null>(null);
  const [inspecting, setInspecting] = useState<TargetRecord | null>(null);

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

  return (
    <section className="page">
      <div className="page-header">
        <h2>Targets</h2>
        <p className="muted">Create, validate, and maintain target endpoints.</p>
      </div>
      <TargetErrors message={error} />
      {loading ? <p className="muted">Loading targets…</p> : null}
      <div className="targets-grid">
        <div className="targets-column">
          <TargetCreateForm onCreate={handleCreate} disabled={loading} />
          {editing ? (
            <TargetEditForm
              target={editing}
              onSave={handleEditSave}
              onCancel={() => setEditing(null)}
            />
          ) : null}
          <TargetDetails target={inspecting} />
        </div>
        <div className="targets-column">
          <TargetList
            title="Active targets"
            targets={activeTargets}
            onEdit={(target) => setEditing(target)}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onRetry={handleRetry}
            onInspect={(target) => setInspecting(target)}
            selectedId={inspecting?.id ?? null}
          />
          <TargetList
            title="Archived targets"
            targets={archivedTargets}
            onEdit={(target) => setEditing(target)}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onRetry={handleRetry}
            onInspect={(target) => setInspecting(target)}
            selectedId={inspecting?.id ?? null}
          />
        </div>
      </div>
    </section>
  );
}
