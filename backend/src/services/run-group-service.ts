import crypto from 'crypto';

import {
  getRunGroup,
  insertRunGroup,
  insertRunGroupItem,
  listRunGroupItems,
  updateRunGroupItemStatus,
  updateRunGroupStatus,
  type RunGroupItemRecord,
  type RunGroupRecord,
  type RunGroupStatus
} from '../models/run-group.js';
import { getInferenceServerById } from '../models/inference-server.js';
import { nowIso } from '../models/repositories.js';
import { instantiateActiveTests, listTemplateRecords } from './template-service.js';
import { createSingleRun, getRun, listRunResults, requestCancelRun, type RunRecord, type RunResultRecord } from './run-service.js';
import { saveSuite } from './suite-service.js';
import { logEvent } from './observability.js';

const MAX_TARGETS = 8;
const LETTERS = 'ABCDEFGH'.split('');

export interface RunGroupTargetInput {
  inference_server_id: string;
  model_id: string;
}

export interface CreateRunGroupInput {
  targets: RunGroupTargetInput[];
  selected_template_ids: string[];
  test_overrides?: Record<string, unknown> | null;
  profile_id?: string | null;
  profile_version?: string | null;
}

export interface RunGroupItemDetail extends RunGroupItemRecord {
  run: RunRecord | null;
  results: RunResultRecord[];
}

export interface RunGroupDetail extends RunGroupRecord {
  items: RunGroupItemDetail[];
}

export class RunGroupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RunGroupValidationError';
  }
}

function buildId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(10).toString('hex')}`;
}

function validateTargets(targets: RunGroupTargetInput[]): RunGroupTargetInput[] {
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new RunGroupValidationError('At least one target is required.');
  }
  if (targets.length > MAX_TARGETS) {
    throw new RunGroupValidationError(`Run groups support at most ${MAX_TARGETS} targets.`);
  }

  const seen = new Set<string>();
  return targets.map((target, index) => {
    const inferenceServerId = String(target?.inference_server_id ?? '').trim();
    const modelId = String(target?.model_id ?? '').trim();
    if (!inferenceServerId || !modelId) {
      throw new RunGroupValidationError(`Target ${index + 1} must include inference_server_id and model_id.`);
    }
    const key = `${inferenceServerId}\u0000${modelId}`;
    if (seen.has(key)) {
      throw new RunGroupValidationError('Run group targets must be unique by inference_server_id and model_id.');
    }
    seen.add(key);
    if (!getInferenceServerById(inferenceServerId)) {
      throw new RunGroupValidationError(`Inference server not found: ${inferenceServerId}`);
    }
    return { inference_server_id: inferenceServerId, model_id: modelId };
  });
}

function validateTemplateIds(templateIds: string[]): string[] {
  if (!Array.isArray(templateIds) || templateIds.length === 0) {
    throw new RunGroupValidationError('selected_template_ids must contain at least one template id.');
  }
  const trimmed = templateIds.map((id) => String(id ?? '').trim()).filter(Boolean);
  if (trimmed.length === 0) {
    throw new RunGroupValidationError('selected_template_ids must contain at least one template id.');
  }
  const unique = Array.from(new Set(trimmed));
  const available = new Set(listTemplateRecords().map((template) => template.id));
  const missing = unique.find((templateId) => !available.has(templateId));
  if (missing) {
    throw new RunGroupValidationError(`Template not found: ${missing}`);
  }
  return unique;
}

function aggregateStatus(items: RunGroupItemRecord[]): RunGroupStatus {
  if (items.some((item) => item.status === 'canceled')) {
    return 'canceled';
  }
  if (items.some((item) => item.status === 'running' || item.status === 'queued')) {
    return 'running';
  }
  if (items.some((item) => item.status === 'failed')) {
    return 'failed';
  }
  return 'completed';
}

function refreshGroupStatus(groupId: string): void {
  const group = getRunGroup(groupId);
  if (!group || group.status === 'canceled') {
    return;
  }
  const items = listRunGroupItems(groupId);
  const status = aggregateStatus(items);
  updateRunGroupStatus(groupId, status, {
    ended_at: status === 'running' ? null : nowIso()
  });
}

async function executeGroupItem(
  group: RunGroupRecord,
  item: RunGroupItemRecord,
  templateIds: string[]
): Promise<void> {
  const startedAt = nowIso();
  updateRunGroupItemStatus(item.id, 'running', { started_at: startedAt });
  try {
    const activeTests = instantiateActiveTests({
      inference_server_id: item.inference_server_id,
      model_name: item.model_id,
      template_ids: templateIds,
      param_overrides: group.test_overrides ?? undefined
    });

    const runInput = {
      run_id: item.child_run_id,
      inference_server_id: item.inference_server_id,
      model: item.model_id,
      profile_id: group.profile_id ?? undefined,
      profile_version: group.profile_version ?? undefined,
      test_overrides: {
        ...(group.test_overrides ?? {}),
        model: item.model_id
      }
    };

    const run =
      activeTests.length === 1
        ? await createSingleRun({
            ...runInput,
            test_id: activeTests[0].id
          })
        : await (async () => {
            const suiteId = `group-${group.id}-${item.stable_letter}`;
            saveSuite({
              id: suiteId,
              name: `Run group ${group.id} · ${item.stable_letter}`,
              ordered_test_ids: activeTests.map((test) => test.id),
              stop_on_fail: false
            });
            return createSingleRun({
              ...runInput,
              suite_id: suiteId
            });
          })();

    updateRunGroupItemStatus(item.id, run.status as RunGroupStatus, {
      ended_at: run.ended_at ?? nowIso()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Run group item failed.';
    updateRunGroupItemStatus(item.id, 'failed', {
      failure_reason: message,
      ended_at: nowIso()
    });
    logEvent({
      level: 'error',
      message: 'Run group item failed',
      run_id: item.child_run_id,
      meta: { group_id: group.id, item_id: item.id, error: message }
    });
  } finally {
    refreshGroupStatus(group.id);
  }
}

async function executeGroup(groupId: string): Promise<void> {
  const group = getRunGroup(groupId);
  if (!group || group.status === 'canceled') {
    return;
  }
  updateRunGroupStatus(groupId, 'running');
  const items = listRunGroupItems(groupId);
  await Promise.all(items.map((item) => executeGroupItem(group, item, group.selected_template_ids)));
  refreshGroupStatus(groupId);
}

export function createRunGroup(input: CreateRunGroupInput): RunGroupDetail {
  const targets = validateTargets(input.targets);
  const templateIds = validateTemplateIds(input.selected_template_ids);
  const groupId = buildId('rg');
  const group = insertRunGroup({
    id: groupId,
    status: 'running',
    selected_template_ids: templateIds,
    test_overrides: input.test_overrides ?? null,
    profile_id: input.profile_id ?? null,
    profile_version: input.profile_version ?? null
  });

  targets.forEach((target, index) => {
    insertRunGroupItem({
      id: buildId('rgi'),
      group_id: groupId,
      child_run_id: buildId('run'),
      inference_server_id: target.inference_server_id,
      model_id: target.model_id,
      stable_letter: LETTERS[index],
      accent_index: index,
      status: 'queued'
    });
  });

  void executeGroup(groupId).catch((error) => {
    const message = error instanceof Error ? error.message : 'Run group execution failed.';
    logEvent({ level: 'error', message, meta: { group_id: groupId } });
    updateRunGroupStatus(groupId, 'failed', { ended_at: nowIso() });
  });

  return getRunGroupDetail(group.id)!;
}

export function getRunGroupDetail(id: string): RunGroupDetail | null {
  const group = getRunGroup(id);
  if (!group) {
    return null;
  }
  const items = listRunGroupItems(id).map((item) => ({
    ...item,
    run: getRun(item.child_run_id),
    results: listRunResults(item.child_run_id)
  }));
  return { ...group, items };
}

export function cancelRunGroup(id: string): RunGroupDetail | null {
  const group = getRunGroup(id);
  if (!group) {
    return null;
  }
  const endedAt = nowIso();
  updateRunGroupStatus(id, 'canceled', { ended_at: endedAt });
  for (const item of listRunGroupItems(id)) {
    requestCancelRun(item.child_run_id);
    updateRunGroupItemStatus(item.id, 'canceled', {
      failure_reason: 'Canceled',
      ended_at: endedAt
    });
  }
  return getRunGroupDetail(id);
}
