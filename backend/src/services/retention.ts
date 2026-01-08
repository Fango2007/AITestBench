const DEFAULT_RETENTION_DAYS = 30;

export function getRetentionDays(): number {
  const envValue = process.env.RETENTION_DAYS;
  if (!envValue) {
    return DEFAULT_RETENTION_DAYS;
  }

  const parsed = Number(envValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_RETENTION_DAYS;
  }

  return parsed;
}
