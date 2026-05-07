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
  globalThis.fetch = backendFetch;

  return true;
}

export function backendFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!backendFetchDispatcher) {
    return globalThis.fetch(input, init);
  }

  return undiciFetch(input, {
    ...(init ?? {}),
    dispatcher: backendFetchDispatcher
  } as RequestInit & { dispatcher: Dispatcher }) as unknown as Promise<Response>;
}
