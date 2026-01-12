import { getDb } from '../models/db.js';
import { getRetentionDays } from './retention.js';

export interface RetentionSummary {
  cutoff: string;
  runs_deleted: number;
  reason: string;
}

export function cleanupExpiredRuns(): RetentionSummary {
  const db = getDb();
  const retentionDays = getRetentionDays();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoff = cutoffDate.toISOString();

  const runs = db
    .prepare('SELECT id FROM runs WHERE started_at < ?')
    .all(cutoff) as Array<{ id: string }>;

  const runIds = runs.map((row) => row.id);
  if (runIds.length === 0) {
    return { cutoff, runs_deleted: 0, reason: 'No runs exceed retention window' };
  }

  const placeholders = runIds.map(() => '?').join(',');
  const resultIds = db
    .prepare(`SELECT id FROM test_results WHERE run_id IN (${placeholders})`)
    .all(...runIds) as Array<{ id: string }>;

  const resultIdList = resultIds.map((row) => row.id);

  if (resultIdList.length > 0) {
    const metricPlaceholders = resultIdList.map(() => '?').join(',');
    db.prepare(`DELETE FROM metric_samples WHERE test_result_id IN (${metricPlaceholders})`).run(
      ...resultIdList
    );
  }

  db.prepare(`DELETE FROM test_results WHERE run_id IN (${placeholders})`).run(...runIds);
  db.prepare(`DELETE FROM runs WHERE id IN (${placeholders})`).run(...runIds);

  return {
    cutoff,
    runs_deleted: runIds.length,
    reason: `Retention ${retentionDays} days`
  };
}
