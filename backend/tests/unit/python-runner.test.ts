import { describe, expect, it } from 'vitest';

import { runPythonModule } from '../../src/plugins/python-runner';

describe('python runner', () => {
  it('rejects disallowed paths', async () => {
    await expect(
      runPythonModule('/tmp/not-allowed.py', { timeoutMs: 10, allowedPaths: [] })
    ).rejects.toThrow();
  });
});
