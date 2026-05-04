import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';
import { configureInferenceProxyFromEnv } from './services/inference-proxy.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, '..', '..');
const envPath = path.join(repoRoot, '.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.info(`[env] Loaded ${envPath}`);
} else {
  dotenv.config();
}

if (configureInferenceProxyFromEnv()) {
  console.info('[env] Inference server outbound proxy enabled via AITESTBENCH_INFERENCE_PROXY');
}

import { createServer } from './api/server.js';


const app = createServer();
const port = Number(process.env.PORT || 8080);

app.listen({ port, host: '0.0.0.0' }).catch((err: unknown) => {
  app.log.error(err, 'Failed to start server');
  process.exit(1);
});
