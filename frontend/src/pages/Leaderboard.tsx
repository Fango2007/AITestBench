import { useEffect, useMemo, useState } from 'react';

import { LeaderboardFilters } from '../components/LeaderboardFilters.js';
import type { LeaderboardFilterValues } from '../components/LeaderboardFilters.js';
import { LeaderboardTable } from '../components/LeaderboardTable.js';
import type { LeaderboardEntry, LeaderboardFilters as ApiFilters } from '../services/leaderboard-api.js';
import { getLeaderboard } from '../services/leaderboard-api.js';
import { listModels } from '../services/models-api.js';
import type { ModelRecord } from '../services/models-api.js';

interface LeaderboardProps {
  setView: (view: string) => void;
}

export function Leaderboard({ setView }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<ApiFilters>({});
  const [hasActiveFilters, setHasActiveFilters] = useState(false);
  const [modelRecords, setModelRecords] = useState<ModelRecord[]>([]);

  const modelDisplayMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const record of modelRecords) {
      if (!map.has(record.model.model_id))
        map.set(record.model.model_id, record.model.base_model_name ?? record.model.display_name);
    }
    return map;
  }, [modelRecords]);

  function fetchLeaderboard(filters: ApiFilters = {}) {
    setLoading(true);
    setError(null);
    getLeaderboard(filters)
      .then((data) => {
        setEntries(data.entries);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchLeaderboard();
    listModels().then(setModelRecords).catch(() => {});

    const handleSaved = () => fetchLeaderboard(activeFilters);
    const handleDatabaseCleared = () => {
      setEntries([]);
      setModelRecords([]);
      setActiveFilters({});
      setHasActiveFilters(false);
      setError(null);
      setLoading(false);
    };
    window.addEventListener('evaluations:saved', handleSaved);
    window.addEventListener('database:cleared', handleDatabaseCleared);
    return () => {
      window.removeEventListener('evaluations:saved', handleSaved);
      window.removeEventListener('database:cleared', handleDatabaseCleared);
    };
  }, []);

  function handleApply(filterValues: LeaderboardFilterValues) {
    const filters: ApiFilters = {};
    if (filterValues.date_from) filters.date_from = filterValues.date_from;
    if (filterValues.date_to) filters.date_to = filterValues.date_to;
    if (filterValues.tags.length > 0) filters.tags = filterValues.tags;
    setActiveFilters(filters);
    setHasActiveFilters(Object.keys(filters).length > 0);
    fetchLeaderboard(filters);
  }

  function handleClear() {
    setActiveFilters({});
    setHasActiveFilters(false);
    fetchLeaderboard({});
  }

  return (
    <div className="page-leaderboard">
      <div className="page-header">
        <h2>Leaderboard</h2>
      </div>
      <LeaderboardFilters onApply={handleApply} onClear={handleClear} />
      {error ? (
        <p className="error">{error}</p>
      ) : loading ? (
        <p className="muted">Loading…</p>
      ) : entries.length === 0 ? (
        hasActiveFilters ? (
          <p className="muted">No evaluations match the selected filters.</p>
        ) : (
          <div className="empty-state">
            <p>No evaluations yet.</p>
            <button type="button" onClick={() => setView('evaluate')}>
              Create your first evaluation
            </button>
          </div>
        )
      ) : (
        <LeaderboardTable entries={entries} modelDisplayMap={modelDisplayMap} />
      )}
    </div>
  );
}
