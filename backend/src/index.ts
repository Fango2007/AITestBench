import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, '..', '..');
const envPath = path.join(repoRoot, '.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  const envContents = fs.readFileSync(envPath, 'utf8');
  console.info(`[env] Loaded ${envPath}\n${envContents}`);
} else {
  dotenv.config();
}

import { createServer } from './api/server.js';


const app = createServer();
const port = Number(process.env.PORT || 9091);

app.listen({ port, host: '0.0.0.0' }).catch((err: unknown) => {
  app.log.error(err, 'Failed to start server');
  process.exit(1);
});
