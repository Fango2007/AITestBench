export type RegLightState = 'healthy' | 'degraded' | 'down' | 'unknown' | 'up';

export interface RegLightProps {
  state: RegLightState;
  label?: string;
  latencyMs?: number | null;
  lastProbe?: string | null;
  statusCode?: number | string | null;
  error?: string | null;
  compact?: boolean;
}

function normalizedState(state: RegLightState): 'healthy' | 'degraded' | 'down' | 'unknown' {
  return state === 'up' ? 'healthy' : state;
}

function relativeTime(value: string | null | undefined): string {
  if (!value) return 'never';
  const time = Date.parse(value);
  if (Number.isNaN(time)) return 'unknown';
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function regLightTooltip(props: RegLightProps): string {
  const state = normalizedState(props.state);
  return [
    props.label ? `${props.label}: ${state}` : state,
    props.latencyMs != null ? `latency ${props.latencyMs}ms` : 'latency n/a',
    `last probe ${relativeTime(props.lastProbe)}`,
    props.statusCode != null ? `status ${props.statusCode}` : null,
    props.error ? `error ${props.error}` : null
  ].filter(Boolean).join(' · ');
}

export function RegLight(props: RegLightProps) {
  const state = normalizedState(props.state);
  const label = props.label ?? state;
  return (
    <span className={props.compact ? 'reg-light-wrap is-compact' : 'reg-light-wrap'} title={regLightTooltip(props)}>
      <span className={`reg-light-dot reg-light-dot--${state}`} aria-hidden="true" />
      {props.compact ? <span className="sr-only">{label}</span> : <span>{label}</span>}
    </span>
  );
}
