import { beforeEach, describe, expect, it, vi } from 'vitest';

const undiciMock = vi.hoisted(() => ({
  EnvHttpProxyAgent: vi.fn(function (this: { options?: unknown }, options?: unknown) {
    this.options = options;
  }),
  setGlobalDispatcher: vi.fn()
}));

vi.mock('undici', () => undiciMock);

import {
  configureInferenceProxyFromEnv,
  resolveInferenceProxyConfig
} from '../../src/services/inference-proxy.js';

describe('inference proxy configuration', () => {
  beforeEach(() => {
    undiciMock.EnvHttpProxyAgent.mockClear();
    undiciMock.setGlobalDispatcher.mockClear();
  });

  it('does not configure a dispatcher when the backend-specific proxy env var is absent', () => {
    expect(resolveInferenceProxyConfig({ HTTP_PROXY: 'http://proxy.example:8080' })).toBeNull();

    const configured = configureInferenceProxyFromEnv({ HTTP_PROXY: 'http://proxy.example:8080' });

    expect(configured).toBe(false);
    expect(undiciMock.EnvHttpProxyAgent).not.toHaveBeenCalled();
    expect(undiciMock.setGlobalDispatcher).not.toHaveBeenCalled();
  });

  it('trims and resolves backend-specific proxy settings', () => {
    expect(
      resolveInferenceProxyConfig({
        AITESTBENCH_INFERENCE_PROXY: ' http://proxy.example:8080 ',
        AITESTBENCH_INFERENCE_NO_PROXY: ' localhost,127.0.0.1 '
      })
    ).toEqual({
      proxy: 'http://proxy.example:8080',
      noProxy: 'localhost,127.0.0.1'
    });
  });

  it('configures a global Undici dispatcher for backend fetch calls', () => {
    const configured = configureInferenceProxyFromEnv({
      AITESTBENCH_INFERENCE_PROXY: 'http://proxy.example:8080',
      AITESTBENCH_INFERENCE_NO_PROXY: 'localhost,127.0.0.1'
    });

    expect(configured).toBe(true);
    expect(undiciMock.EnvHttpProxyAgent).toHaveBeenCalledWith({
      httpProxy: 'http://proxy.example:8080',
      httpsProxy: 'http://proxy.example:8080',
      noProxy: 'localhost,127.0.0.1'
    });
    expect(undiciMock.setGlobalDispatcher).toHaveBeenCalledTimes(1);
    expect(undiciMock.setGlobalDispatcher).toHaveBeenCalledWith(
      undiciMock.EnvHttpProxyAgent.mock.instances[0]
    );
  });
});
