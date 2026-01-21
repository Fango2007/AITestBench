import { describe, expect, it } from 'vitest';

import { runCli } from '../support/cli-runner.js';

describe('cli single run', () => {
  it('invokes the run command', async () => {
    const result = await runCli(['test', 'run', '--id', 'basic', '--target', 'local']);
    expect(result.exitCode).toBe(0);
  });
});
