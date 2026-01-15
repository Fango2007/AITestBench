import Fastify from 'fastify';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { runSchema } from '../models/db.js';
import { reloadTests } from '../services/test-service.js';
import { registerAuth } from './middleware/auth.js';
import { registerResultsRoutes } from './routes/results.js';
import { registerRunsRoutes } from './routes/runs.js';
import { registerSuitesRoutes } from './routes/suites.js';
import { registerInferenceServersRoutes } from './routes/inference-servers.js';
import { registerTestsRoutes } from './routes/tests.js';
import { registerProfilesRoutes } from './routes/profiles.js';
import { registerModelsRoutes } from './routes/models.js';
import { registerSystemRoutes } from './routes/system.js';
import { registerTemplatesRoutes } from './routes/templates.js';

export function createServer() {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const schemaPath = path.resolve(moduleDir, '../models/schema.sql');
  if (fs.existsSync(schemaPath)) {
    runSchema(fs.readFileSync(schemaPath, 'utf8'));
  }

  reloadTests();

  registerAuth(app);

  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin ?? '*';
    const reqHeaders = request.headers['access-control-request-headers'];
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    reply.header(
      'Access-Control-Allow-Headers',
      typeof reqHeaders === 'string' && reqHeaders.length > 0
        ? reqHeaders
        : 'content-type,x-api-token'
    );
    if (request.method === 'OPTIONS') {
      reply.code(204).send();
    }
  });

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-DNS-Prefetch-Control', 'off');
    return payload;
  });

  app.get('/health', async () => ({ status: 'ok' }));

  registerSystemRoutes(app);
  registerInferenceServersRoutes(app);
  registerTestsRoutes(app);
  registerRunsRoutes(app);
  registerSuitesRoutes(app);
  registerProfilesRoutes(app);
  registerModelsRoutes(app);
  registerResultsRoutes(app);
  registerTemplatesRoutes(app);

  return app;
}
