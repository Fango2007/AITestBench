import { FastifyInstance } from 'fastify';

import { fetchProfiles, saveProfile } from '../../services/profile-service';

export function registerProfilesRoutes(app: FastifyInstance): void {
  app.get('/profiles', async () => fetchProfiles());

  app.post('/profiles', async (request, reply) => {
    const profile = saveProfile(request.body as Record<string, unknown>);
    reply.code(201).send(profile);
  });
}
