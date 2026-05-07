import { createRequire } from 'module';

import { describe, expect, it } from 'vitest';
import { EnvHttpProxyAgent, type Dispatcher } from 'undici';

const require = createRequire(import.meta.url);
const { kDispatch } = require('undici/lib/core/symbols') as { kDispatch: symbol };

function dispatch(agent: EnvHttpProxyAgent, options: Dispatcher.DispatchOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    agent.dispatch(options, {
      onResponseStart: () => undefined,
      onResponseEnd: () => resolve(),
      onResponseError: (_controller, error) => reject(error)
    });
  });
}

describe('inference proxy protocol behavior', () => {
  it('rewrites backend HTTP proxy requests to absolute-form', async () => {
    const previousNoProxy = process.env.NO_PROXY;
    process.env.NO_PROXY = 'example.com';

    const captured: Dispatcher.DispatchOptions[] = [];
    const proxyClient = {
      [kDispatch]: (options: Dispatcher.DispatchOptions, handler: Dispatcher.DispatchHandler) => {
        captured.push(options);
        handler.onResponseStart?.({} as Dispatcher.DispatchController, 200, {}, 'OK');
        handler.onResponseEnd?.({} as Dispatcher.DispatchController, {});
        return true;
      },
      close: () => Promise.resolve(),
      destroy: () => Promise.resolve()
    };

    const agent = new EnvHttpProxyAgent({
      httpProxy: 'http://proxy.example:8080',
      noProxy: '',
      proxyTunnel: false,
      factory: () => proxyClient as unknown as Dispatcher
    });

    try {
      await dispatch(agent, {
        origin: 'http://example.com',
        path: '/v1/models',
        method: 'GET',
        headers: {}
      });

      expect(captured).toHaveLength(1);
      expect(captured[0].method).toBe('GET');
      expect(captured[0].path).toBe('http://example.com/v1/models');
      expect(captured[0].headers).toMatchObject({ host: 'example.com' });
    } finally {
      await agent.close();
      if (previousNoProxy === undefined) {
        delete process.env.NO_PROXY;
      } else {
        process.env.NO_PROXY = previousNoProxy;
      }
    }
  });
});
