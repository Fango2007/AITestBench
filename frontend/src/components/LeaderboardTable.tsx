import type { LeaderboardEntry } from '../services/leaderboard-api.js';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  modelDisplayMap?: Map<string, string>;
}

function fmt(value: number | null, decimals = 2): string {
  if (value === null) return 'N/A';
  return value.toFixed(decimals);
}

export function LeaderboardTable({ entries, modelDisplayMap }: LeaderboardTableProps) {
  return (
    <div className="table-wrapper">
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Model</th>
            <th>Composite Score</th>
            <th>Accuracy</th>
            <th>Relevance</th>
            <th>Coherence</th>
            <th>Completeness</th>
            <th>Helpfulness</th>
            <th>Avg Tokens</th>
            <th>Avg Latency (ms)</th>
            <th>Avg Cost ($)</th>
            <th>Evaluations</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={12} className="empty-state-cell">No entries to display.</td>
            </tr>
          ) : (
            entries.map((entry) => (
              <tr key={entry.model_name}>
                <td>{entry.rank}</td>
                <td>{modelDisplayMap?.get(entry.model_name) ?? entry.model_name}</td>
                <td>{fmt(entry.composite_score, 4)}</td>
                <td>{fmt(entry.avg_accuracy)}</td>
                <td>{fmt(entry.avg_relevance)}</td>
                <td>{fmt(entry.avg_coherence)}</td>
                <td>{fmt(entry.avg_completeness)}</td>
                <td>{fmt(entry.avg_helpfulness)}</td>
                <td>{fmt(entry.avg_total_tokens, 0)}</td>
                <td>{fmt(entry.avg_latency_ms, 0)}</td>
                <td>{entry.avg_estimated_cost !== null ? `$${entry.avg_estimated_cost.toFixed(6)}` : 'N/A'}</td>
                <td>{entry.evaluation_count}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
