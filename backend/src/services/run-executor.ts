import { logEvent } from './observability';

export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled';

export interface RunExecutionRequest {
  run_id: string;
  target_id: string;
  test_id?: string | null;
  suite_id?: string | null;
  profile_id?: string | null;
  profile_version?: string | null;
  max_retries?: number;
}

export interface RunExecutionResult {
  status: RunStatus;
  started_at: string;
  ended_at: string;
  failure_reason?: string;
}

export async function executeRun(
  request: RunExecutionRequest
): Promise<RunExecutionResult> {
  const startedAt = new Date().toISOString();
  const retries = request.max_retries ?? 0;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    logEvent({
      level: 'info',
      message: 'Run execution started',
      run_id: request.run_id,
      test_id: request.test_id ?? undefined,
      meta: { attempt, retries }
    });
  }

  return {
    status: 'completed',
    started_at: startedAt,
    ended_at: new Date().toISOString()
  };
}
