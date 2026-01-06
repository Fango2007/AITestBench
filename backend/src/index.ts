import { createServer } from './api/server';

const app = createServer();
const port = Number(process.env.PORT || 8080);

app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err, 'Failed to start server');
  process.exit(1);
});
