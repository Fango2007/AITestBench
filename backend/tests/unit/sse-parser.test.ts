import { describe, expect, it } from 'vitest';

import { parseSseEvents } from '../../src/services/sse-parser';

describe('parseSseEvents', () => {
  it('parses data events and end markers', () => {
    const input = 'data: {"id":1}\n\n data: [DONE]\n\n';
    const events = parseSseEvents(input);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toMatchObject({ type: 'data' });
  });
});
