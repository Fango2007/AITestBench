import Fastify from 'fastify';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { runSchema } from '../models/db';
import { reloadTests } from '../services/test-service';
import { registerAuth } from './middleware/auth';
import { registerResultsRoutes } from './routes/results';
import { registerRunsRoutes } from './routes/runs';
import { registerSuitesRoutes } from './routes/suites';
import { registerTargetsRoutes } from './routes/targets';
import { registerTestsRoutes } from './routes/tests';
import { registerProfilesRoutes } from './routes/profiles';
import { registerModelsRoutes } from './routes/models';
import { registerTestTemplatesRoutes } from './routes/test-templates';

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
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
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

  registerTargetsRoutes(app);
  registerTestsRoutes(app);
  registerRunsRoutes(app);
  registerSuitesRoutes(app);
  registerProfilesRoutes(app);
  registerModelsRoutes(app);
  registerResultsRoutes(app);
  registerTestTemplatesRoutes(app);

  return app;
}
