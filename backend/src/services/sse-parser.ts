export interface SseEvent {
  type: 'data' | 'done';
  payload?: string;
}

export function parseSseEvents(raw: string): SseEvent[] {
  const events: SseEvent[] = [];
  const chunks = raw.split(/\n\n/);
  for (const chunk of chunks) {
    const line = chunk.trim();
    if (!line) {
      continue;
    }
    const dataPrefix = 'data:';
    if (line.startsWith(dataPrefix)) {
      const payload = line.slice(dataPrefix.length).trim();
      if (payload === '[DONE]') {
        events.push({ type: 'done' });
      } else {
        events.push({ type: 'data', payload });
      }
    }
  }
  return events;
}
