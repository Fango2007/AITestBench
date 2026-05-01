import { FastifyInstance } from 'fastify';

import { fetchProfiles, saveProfile, type ProfileInput } from '../../services/profile-service.js';

export function registerProfilesRoutes(app: FastifyInstance): void {
  app.get('/profiles', async () => fetchProfiles());

  app.post('/profiles', async (request, reply) => {
    const profile = saveProfile(request.body as unknown as ProfileInput);
    reply.code(201).send(profile);
  });
}
