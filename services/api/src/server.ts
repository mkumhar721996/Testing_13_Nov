import { buildApp } from './app.js';
import { devResolveUserId } from './dev-session.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

buildApp({ resolveUserId: devResolveUserId(process.env) })
  .listen({ port, host })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
