import Fastify from 'fastify';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { getDb, resolvedDbPath, runSchema } from '../models/db.js';
import { reloadTests } from '../services/test-service.js';
import { registerAuth } from './middleware/auth.js';
import { registerResultsRoutes } from './routes/results.js';
import { registerResultsViewRoutes } from './routes/results-view.js';
import { registerRunsRoutes } from './routes/runs.js';
import { registerRunGroupsRoutes } from './routes/run-groups.js';
import { registerSuitesRoutes } from './routes/suites.js';
import { registerInferenceServersRoutes } from './routes/inference-servers.js';
import { registerTestsRoutes } from './routes/tests.js';
import { registerProfilesRoutes } from './routes/profiles.js';
import { registerModelsRoutes } from './routes/models.js';
import { registerSystemRoutes } from './routes/system.js';
import { registerTemplatesRoutes } from './routes/templates.js';
import { registerDashboardResultsRoutes } from './routes/dashboard-results.js';
import { registerEvalInferenceRoutes } from './routes/eval-inference.js';
import { registerEvaluationsRoutes } from './routes/evaluations.js';
import { registerLeaderboardRoutes } from './routes/leaderboard.js';
import { registerArchitectureRoutes } from './routes/architecture.js';

function applyColumnMigrations(): void {
  const db = getDb();
  const columns = (db.prepare('PRAGMA table_info(models)').all() as Array<{ name: string }>).map((c) => c.name);
  if (!columns.includes('base_model_name')) {
    db.exec('ALTER TABLE models ADD COLUMN base_model_name TEXT');
  }
}

export function createServer() {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const schemaPath = path.resolve(moduleDir, '../models/schema.sql');
  if (fs.existsSync(schemaPath)) {
    runSchema(fs.readFileSync(schemaPath, 'utf8'));
  }
  applyColumnMigrations();
  if (process.env.AITESTBENCH_E2E === '1' && process.env.AITESTBENCH_E2E_MARKER_PATH) {
    fs.mkdirSync(path.dirname(process.env.AITESTBENCH_E2E_MARKER_PATH), { recursive: true });
    fs.writeFileSync(
      process.env.AITESTBENCH_E2E_MARKER_PATH,
      JSON.stringify({ db_path: resolvedDbPath(), pid: process.pid, created_at: new Date().toISOString() }, null, 2),
      'utf8'
    );
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

  app.get('/health', async () => {
    const payload: { status: 'ok'; db_path?: string } = { status: 'ok' };
    if (process.env.AITESTBENCH_E2E === '1') {
      payload.db_path = resolvedDbPath();
    }
    return payload;
  });

  registerSystemRoutes(app);
  registerInferenceServersRoutes(app);
  registerTestsRoutes(app);
  registerRunsRoutes(app);
  registerRunGroupsRoutes(app);
  registerSuitesRoutes(app);
  registerProfilesRoutes(app);
  registerModelsRoutes(app);
  registerResultsRoutes(app);
  registerResultsViewRoutes(app);
  registerTemplatesRoutes(app);
  registerDashboardResultsRoutes(app);
  registerEvalInferenceRoutes(app);
  registerEvaluationsRoutes(app);
  registerLeaderboardRoutes(app);
  registerArchitectureRoutes(app);

  return app;
}
