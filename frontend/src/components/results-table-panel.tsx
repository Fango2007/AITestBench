import { DashboardPanel } from '../services/dashboard-results-api.js';

interface ResultsTablePanelProps {
  panel: DashboardPanel;
}

export function ResultsTablePanel({ panel }: ResultsTablePanelProps) {
  const rows = panel.rows ?? [];
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));

  return (
    <article className="card dashboard-panel" data-panel-type="table">
      <header>
        <h3>{panel.title}</h3>
        <p className="muted">
          Runtime: {panel.runtime_key ?? 'unknown'} | Version: {panel.server_version ?? 'unknown'} | Model:{' '}
          {panel.model_id ?? 'unknown'}
        </p>
      </header>
      {rows.length === 0 ? (
        <p className="muted">No rows available.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`${panel.panel_id}:${rowIndex}`}>
                  {columns.map((column) => (
                    <td key={`${rowIndex}:${column}`}>{String(row[column] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
