import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const TOKEN_HEADER = 'x-api-token';

function validateToken(request: FastifyRequest, reply: FastifyReply): void {
  const expected = process.env.LLM_HARNESS_API_TOKEN;
  if (!expected) {
    reply.code(500).send({ error: 'API token not configured' });
    return;
  }

  const provided = request.headers[TOKEN_HEADER] as string | undefined;
  if (!provided || provided !== expected) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
}

export function registerAuth(app: FastifyInstance): void {
  app.addHook('preHandler', (request, reply, done) => {
    validateToken(request, reply);
    if (reply.sent) {
      return;
    }
    done();
  });
}
