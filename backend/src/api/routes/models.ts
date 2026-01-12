import { FastifyInstance } from 'fastify';

import { listModels } from '../../models/model.js';

export function registerModelsRoutes(app: FastifyInstance): void {
  app.get('/models', async () => listModels());
}
