import { getDb } from '../models/db.js';

export interface LeaderboardFilters {
  date_from?: string;
  date_to?: string;
  tags?: string[];
  server_ids?: string[];
  model_names?: string[];
  score_min?: number;
  score_max?: number;
  sort_by?: 'score' | 'latency' | 'cost' | 'pass_rate';
  group_by?: 'model' | 'server' | 'quantization';
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
  score_percent: number;
  pass_rate: number | null;
  group_by: 'model' | 'server' | 'quantization';
  group_key: string;
  group_label: string;
  server_id: string | null;
  server_name: string | null;
  quantization_level: string | null;
  representative_evaluation_id: string | null;
}

export interface LeaderboardResult {
  filters_applied: {
    date_from: string | null;
    date_to: string | null;
    tags: string[];
    server_ids: string[];
    model_names: string[];
    score_min: number | null;
    score_max: number | null;
    sort_by: string;
    group_by: string;
  };
  entries: LeaderboardEntry[];
}

interface LeaderboardRow {
  id: string;
  model_name: string;
  server_id: string;
  server_name: string | null;
  inference_config: string;
  accuracy_score: number;
  relevance_score: number;
  coherence_score: number;
  completeness_score: number;
  helpfulness_score: number;
  total_tokens: number | null;
  latency_ms: number | null;
  estimated_cost: number | null;
  created_at: string;
}

type GroupBy = NonNullable<LeaderboardFilters['group_by']>;
type SortBy = NonNullable<LeaderboardFilters['sort_by']>;

type GroupAccumulator = {
  group_key: string;
  group_label: string;
  model_name: string;
  server_id: string | null;
  server_name: string | null;
  quantization_level: string | null;
  accuracy: number[];
  relevance: number[];
  coherence: number[];
  completeness: number[];
  helpfulness: number[];
  tokens: number[];
  latencies: number[];
  costs: number[];
  representative: { id: string; score: number; created_at: string } | null;
};

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number, places = 4): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function parseConfig(value: string): { quantization_level?: string | null } {
  try {
    return JSON.parse(value) as { quantization_level?: string | null };
  } catch {
    return {};
  }
}

function rowScore(row: LeaderboardRow): number {
  return (
    row.accuracy_score +
    row.relevance_score +
    row.coherence_score +
    row.completeness_score +
    row.helpfulness_score
  ) / 5;
}

function groupIdentity(row: LeaderboardRow, groupBy: GroupBy): Pick<
  GroupAccumulator,
  'group_key' | 'group_label' | 'model_name' | 'server_id' | 'server_name' | 'quantization_level'
> {
  const quantization = parseConfig(row.inference_config).quantization_level?.trim() || 'unknown';
  if (groupBy === 'server') {
    return {
      group_key: row.server_id,
      group_label: row.server_name ?? row.server_id,
      model_name: row.model_name,
      server_id: row.server_id,
      server_name: row.server_name,
      quantization_level: quantization
    };
  }
  if (groupBy === 'quantization') {
    return {
      group_key: quantization,
      group_label: quantization,
      model_name: row.model_name,
      server_id: row.server_id,
      server_name: row.server_name,
      quantization_level: quantization
    };
  }
  return {
    group_key: row.model_name,
    group_label: row.model_name,
    model_name: row.model_name,
    server_id: row.server_id,
    server_name: row.server_name,
    quantization_level: quantization
  };
}

function createGroup(identity: ReturnType<typeof groupIdentity>): GroupAccumulator {
  return {
    ...identity,
    accuracy: [],
    relevance: [],
    coherence: [],
    completeness: [],
    helpfulness: [],
    tokens: [],
    latencies: [],
    costs: [],
    representative: null
  };
}

function pushNumber(target: number[], value: number | null): void {
  if (typeof value === 'number' && Number.isFinite(value)) {
    target.push(value);
  }
}

function groupToEntry(group: GroupAccumulator, groupBy: GroupBy): LeaderboardEntry {
  const avgAccuracy = average(group.accuracy) ?? 0;
  const avgRelevance = average(group.relevance) ?? 0;
  const avgCoherence = average(group.coherence) ?? 0;
  const avgCompleteness = average(group.completeness) ?? 0;
  const avgHelpfulness = average(group.helpfulness) ?? 0;
  const composite = (avgAccuracy + avgRelevance + avgCoherence + avgCompleteness + avgHelpfulness) / 5;
  return {
    rank: 0,
    model_name: group.model_name,
    composite_score: round(composite),
    avg_accuracy: avgAccuracy,
    avg_relevance: avgRelevance,
    avg_coherence: avgCoherence,
    avg_completeness: avgCompleteness,
    avg_helpfulness: avgHelpfulness,
    avg_total_tokens: average(group.tokens),
    avg_latency_ms: average(group.latencies),
    avg_estimated_cost: average(group.costs),
    evaluation_count: group.accuracy.length,
    score_percent: round(composite * 20, 2),
    pass_rate: null,
    group_by: groupBy,
    group_key: group.group_key,
    group_label: group.group_label,
    server_id: group.server_id,
    server_name: group.server_name,
    quantization_level: group.quantization_level,
    representative_evaluation_id: group.representative?.id ?? null
  };
}

function compareEntries(sortBy: SortBy): (a: LeaderboardEntry, b: LeaderboardEntry) => number {
  return (a, b) => {
    const value = (entry: LeaderboardEntry): number => {
      if (sortBy === 'latency') {
        return entry.avg_latency_ms ?? Number.MAX_SAFE_INTEGER;
      }
      if (sortBy === 'cost') {
        return entry.avg_estimated_cost ?? Number.MAX_SAFE_INTEGER;
      }
      if (sortBy === 'pass_rate') {
        return entry.pass_rate ?? -1;
      }
      return entry.composite_score;
    };
    const left = value(a);
    const right = value(b);
    if (sortBy === 'latency' || sortBy === 'cost') {
      return left - right || a.group_label.localeCompare(b.group_label);
    }
    return right - left || a.group_label.localeCompare(b.group_label);
  };
}

export function getLeaderboard(filters: LeaderboardFilters): LeaderboardResult {
  const db = getDb();
  const {
    date_from = null,
    date_to = null,
    tags = [],
    server_ids = [],
    model_names = [],
    score_min = undefined,
    score_max = undefined,
    sort_by = 'score',
    group_by = 'model'
  } = filters;

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

  if (server_ids.length > 0) {
    whereClause += ` AND e.server_id IN (${server_ids.map(() => '?').join(', ')})`;
    params.push(...server_ids);
  }

  if (model_names.length > 0) {
    whereClause += ` AND e.model_name IN (${model_names.map(() => '?').join(', ')})`;
    params.push(...model_names);
  }

  const rows = db.prepare(`
    SELECT
      e.id,
      e.model_name,
      e.server_id,
      i.display_name AS server_name,
      e.inference_config,
      e.accuracy_score,
      e.relevance_score,
      e.coherence_score,
      e.completeness_score,
      e.helpfulness_score,
      e.total_tokens,
      e.latency_ms,
      e.estimated_cost,
      e.created_at
    FROM evaluations e
    JOIN eval_prompts ep ON ep.id = e.prompt_id
    LEFT JOIN inference_servers i ON i.server_id = e.server_id
    ${whereClause}
    ORDER BY e.created_at DESC
  `).all(...params) as LeaderboardRow[];

  const groups = new Map<string, GroupAccumulator>();
  for (const row of rows) {
    const scorePercent = rowScore(row) * 20;
    if (score_min != null && scorePercent < score_min) {
      continue;
    }
    if (score_max != null && scorePercent > score_max) {
      continue;
    }
    const identity = groupIdentity(row, group_by);
    const group = groups.get(identity.group_key) ?? createGroup(identity);
    group.accuracy.push(row.accuracy_score);
    group.relevance.push(row.relevance_score);
    group.coherence.push(row.coherence_score);
    group.completeness.push(row.completeness_score);
    group.helpfulness.push(row.helpfulness_score);
    pushNumber(group.tokens, row.total_tokens);
    pushNumber(group.latencies, row.latency_ms);
    pushNumber(group.costs, row.estimated_cost);
    const representative = { id: row.id, score: rowScore(row), created_at: row.created_at };
    if (
      !group.representative ||
      representative.score > group.representative.score ||
      (representative.score === group.representative.score && representative.created_at > group.representative.created_at)
    ) {
      group.representative = representative;
    }
    groups.set(identity.group_key, group);
  }

  const entries = Array.from(groups.values())
    .map((group) => groupToEntry(group, group_by))
    .sort(compareEntries(sort_by))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return {
    filters_applied: {
      date_from,
      date_to,
      tags,
      server_ids,
      model_names,
      score_min: score_min ?? null,
      score_max: score_max ?? null,
      sort_by,
      group_by
    },
    entries
  };
}
