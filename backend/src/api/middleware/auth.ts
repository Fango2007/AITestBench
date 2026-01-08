import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const TOKEN_HEADER = 'x-api-token';

function validateToken(request: FastifyRequest, reply: FastifyReply): boolean {
  const expected = process.env.AITESTBENCH_API_TOKEN;
  if (!expected) {
    reply.code(503).send({ error: 'AITESTBENCH_API_TOKEN is not configured' });
    return false;
  }

  const provided = request.headers[TOKEN_HEADER] as string | undefined;
  if (!provided || provided !== expected) {
    reply.code(401).send({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

export function registerAuth(app: FastifyInstance): void {
  app.addHook('preHandler', async (request, reply) => {
    const ok = validateToken(request, reply);
    if (!ok) {
      return;
    }
  });
}
