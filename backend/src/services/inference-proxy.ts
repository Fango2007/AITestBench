import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';

export const INFERENCE_PROXY_ENV = 'AITESTBENCH_INFERENCE_PROXY';
export const INFERENCE_NO_PROXY_ENV = 'AITESTBENCH_INFERENCE_NO_PROXY';

export interface InferenceProxyConfig {
  proxy: string;
  noProxy?: string;
}

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

  setGlobalDispatcher(
    new EnvHttpProxyAgent({
      httpProxy: config.proxy,
      httpsProxy: config.proxy,
      noProxy: config.noProxy
    })
  );

  return true;
}
