import {
  EnvHttpProxyAgent,
  fetch as undiciFetch,
  setGlobalDispatcher,
  type Dispatcher
} from 'undici';

export const INFERENCE_PROXY_ENV = 'AITESTBENCH_INFERENCE_PROXY';
export const INFERENCE_NO_PROXY_ENV = 'AITESTBENCH_INFERENCE_NO_PROXY';

export interface InferenceProxyConfig {
  proxy: string;
  noProxy?: string;
}

let backendFetchDispatcher: Dispatcher | null = null;
type UndiciFetchInput = Parameters<typeof undiciFetch>[0];
type UndiciFetchInit = Parameters<typeof undiciFetch>[1];

export function resolveInferenceProxyConfig(
  env: NodeJS.ProcessEnv = process.env
): InferenceProxyConfig | null {
  const proxy = env[INFERENCE_PROXY_ENV]?.trim();
  if (!proxy) {
    return null;
  }

  const noProxy = env[INFERENCE_NO_PROXY_ENV]?.trim();
  return noProxy ? { proxy, noProxy } : { proxy };
}

export function configureInferenceProxyFromEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  const config = resolveInferenceProxyConfig(env);
  if (!config) {
    return false;
  }

  backendFetchDispatcher = new EnvHttpProxyAgent({
    httpProxy: config.proxy,
    httpsProxy: config.proxy,
    noProxy: config.noProxy ?? '',
    proxyTunnel: false
  });
  setGlobalDispatcher(backendFetchDispatcher);
  globalThis.fetch = backendFetch as typeof globalThis.fetch;

  return true;
}

export function backendFetch(input: UndiciFetchInput, init?: UndiciFetchInit): ReturnType<typeof undiciFetch> {
  if (!backendFetchDispatcher) {
    return globalThis.fetch(
      input as Parameters<typeof globalThis.fetch>[0],
      init as Parameters<typeof globalThis.fetch>[1]
    ) as ReturnType<typeof undiciFetch>;
  }

  return undiciFetch(input, {
    ...(init ?? {}),
    dispatcher: backendFetchDispatcher
  });
}
