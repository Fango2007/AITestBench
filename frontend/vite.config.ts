import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const configDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(configDir, '..');
  const envLocal = loadEnv(mode, configDir, 'VITE_');
  const envRoot = loadEnv(mode, repoRoot, 'VITE_');
  const env = { ...envRoot, ...envLocal };
  const rawBaseUrl = env.VITE_AITESTBENCH_FRONTEND_BASE_URL;
  let host = 'localhost';
  let port = 5173;

  if (rawBaseUrl) {
    try {
      const parsed = new URL(rawBaseUrl);
      host = parsed.hostname;
      if (parsed.port) {
        port = Number(parsed.port);
      }
    } catch {
      // fall back to defaults if the env var is not a valid URL
    }
  }

  return {
    envDir: repoRoot,
    plugins: [react()],
    server: {
      host,
      port
    }
  };
});
