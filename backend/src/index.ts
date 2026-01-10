import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(moduleDir, '..', '..');
const envPath = path.join(appRoot, '.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

import { createServer } from './api/server';

const app = createServer();
const port = Number(process.env.PORT || 8080);

app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err, 'Failed to start server');
  process.exit(1);
});
