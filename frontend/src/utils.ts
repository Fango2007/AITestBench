export function relativeTime(value: string | null | undefined): string {
  if (!value) return 'never';
  const time = Date.parse(value);
  if (Number.isNaN(time)) return 'unknown';
  const delta = Math.max(0, Date.now() - time);
  const seconds = Math.round(delta / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
