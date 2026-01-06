export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  run_id?: string;
  test_id?: string;
  meta?: Record<string, unknown>;
}

export function logEvent(entry: LogEntry): void {
  const payload = {
    timestamp: new Date().toISOString(),
    ...entry
  };
  const line = JSON.stringify(payload);
  if (entry.level === 'error') {
    console.error(line);
    return;
  }
  console.log(line);
}

export interface MetricEntry {
  name: string;
  value: number;
  run_id?: string;
  test_id?: string;
  tags?: Record<string, string>;
}

export function recordMetric(entry: MetricEntry): void {
  const payload = {
    timestamp: new Date().toISOString(),
    ...entry
  };
  console.log(JSON.stringify({ metric: payload }));
}
