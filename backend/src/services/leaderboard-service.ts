import { getDb } from '../models/db.js';

export interface LeaderboardFilters {
  date_from?: string;
  date_to?: string;
  tags?: string[];
}

export interface LeaderboardEntry {
  rank: number;
  model_name: string;
  composite_score: number;
  avg_accuracy: number;
  avg_relevance: number;
  avg_coherence: number;
  avg_completeness: number;
  avg_helpfulness: number;
  avg_total_tokens: number | null;
  avg_latency_ms: number | null;
  avg_estimated_cost: number | null;
  evaluation_count: number;
}

export interface LeaderboardResult {
  filters_applied: {
    date_from: string | null;
    date_to: string | null;
    tags: string[];
  };
  entries: LeaderboardEntry[];
}

interface LeaderboardRow {
  model_name: string;
  avg_accuracy: number;
  avg_relevance: number;
  avg_coherence: number;
  avg_completeness: number;
  avg_helpfulness: number;
  composite_score: number;
  avg_total_tokens: number | null;
  avg_latency_ms: number | null;
  avg_estimated_cost: number | null;
  evaluation_count: number;
}

export function getLeaderboard(filters: LeaderboardFilters): LeaderboardResult {
  const db = getDb();
  const { date_from = null, date_to = null, tags = [] } = filters;

  const params: unknown[] = [];

  let whereClause = 'WHERE 1=1';

  if (date_from) {
    whereClause += ' AND e.created_at >= ?';
    params.push(date_from);
  }

  if (date_to) {
    whereClause += ' AND e.created_at <= ?';
    params.push(date_to);
  }

  if (tags.length > 0) {
    const placeholders = tags.map(() => '?').join(', ');
    whereClause += ` AND EXISTS (
      SELECT 1 FROM json_each(ep.tags)
      WHERE json_each.value IN (${placeholders})
    )`;
    params.push(...tags);
  }

  const sql = `
    SELECT
      e.model_name,
      AVG(e.accuracy_score)     AS avg_accuracy,
      AVG(e.relevance_score)    AS avg_relevance,
      AVG(e.coherence_score)    AS avg_coherence,
      AVG(e.completeness_score) AS avg_completeness,
      AVG(e.helpfulness_score)  AS avg_helpfulness,
      (AVG(e.accuracy_score) + AVG(e.relevance_score) + AVG(e.coherence_score)
        + AVG(e.completeness_score) + AVG(e.helpfulness_score)) / 5.0 AS composite_score,
      AVG(e.total_tokens)       AS avg_total_tokens,
      AVG(e.latency_ms)         AS avg_latency_ms,
      AVG(e.estimated_cost)     AS avg_estimated_cost,
      COUNT(*)                  AS evaluation_count
    FROM evaluations e
    JOIN eval_prompts ep ON ep.id = e.prompt_id
    ${whereClause}
    GROUP BY e.model_name
    ORDER BY composite_score DESC, e.model_name ASC
  `;

  const rows = db.prepare(sql).all(...params) as LeaderboardRow[];

  const entries: LeaderboardEntry[] = rows.map((row, index) => ({
    rank: index + 1,
    model_name: row.model_name,
    composite_score: Math.round(row.composite_score * 10000) / 10000,
    avg_accuracy: row.avg_accuracy,
    avg_relevance: row.avg_relevance,
    avg_coherence: row.avg_coherence,
    avg_completeness: row.avg_completeness,
    avg_helpfulness: row.avg_helpfulness,
    avg_total_tokens: row.avg_total_tokens,
    avg_latency_ms: row.avg_latency_ms,
    avg_estimated_cost: row.avg_estimated_cost,
    evaluation_count: row.evaluation_count
  }));

  return {
    filters_applied: {
      date_from: date_from,
      date_to: date_to,
      tags
    },
    entries
  };
}
