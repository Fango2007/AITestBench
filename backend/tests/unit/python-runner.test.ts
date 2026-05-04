import { describe, expect, it } from 'vitest';

import { buildPythonProcessEnv, runPythonModule } from '../../src/plugins/python-runner.js';

describe('python runner', () => {
  it('rejects disallowed paths', async () => {
    await expect(
      runPythonModule('/tmp/not-allowed.py', { timeoutMs: 10, allowedPaths: [] })
    ).rejects.toThrow();
  });

  it('maps backend inference proxy env vars to Python HTTP proxy env vars', () => {
    const env = buildPythonProcessEnv({
      AITESTBENCH_INFERENCE_PROXY: 'http://proxy.example:8080',
      AITESTBENCH_INFERENCE_NO_PROXY: 'localhost,127.0.0.1'
    });

    expect(env.HTTP_PROXY).toBe('http://proxy.example:8080');
    expect(env.http_proxy).toBe('http://proxy.example:8080');
    expect(env.HTTPS_PROXY).toBe('http://proxy.example:8080');
    expect(env.https_proxy).toBe('http://proxy.example:8080');
    expect(env.NO_PROXY).toBe('localhost,127.0.0.1');
    expect(env.no_proxy).toBe('localhost,127.0.0.1');
  });

  it('does not override explicit Python proxy env values', () => {
    const env = buildPythonProcessEnv(
      {
        AITESTBENCH_INFERENCE_PROXY: 'http://inference-proxy.example:8080',
        AITESTBENCH_INFERENCE_NO_PROXY: 'localhost'
      },
      {
        HTTP_PROXY: 'http://override-proxy.example:8080',
        NO_PROXY: '127.0.0.1'
      }
    );

    expect(env.HTTP_PROXY).toBe('http://override-proxy.example:8080');
    expect(env.HTTPS_PROXY).toBe('http://inference-proxy.example:8080');
    expect(env.NO_PROXY).toBe('127.0.0.1');
    expect(env.no_proxy).toBe('localhost');
  });
});
