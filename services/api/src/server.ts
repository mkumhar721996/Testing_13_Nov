import { buildApp } from './app.js';
import { serverSession } from './dev-session.js';

const port = Number(process.env.PORT ?? 3000);
const { resolveUserId, host } = serverSession(process.env);

buildApp({ resolveUserId })
  .listen({ port, host })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
