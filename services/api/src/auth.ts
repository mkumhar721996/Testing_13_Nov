import type { FastifyReply, FastifyRequest } from 'fastify';

export type ResolveUserId = (req: FastifyRequest) => Promise<string | undefined>;

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }
}

/** Placeholder until the accounts story provides sessions: nobody is signed in. */
export const noUser: ResolveUserId = async () => undefined;

/** Builds a preHandler that sets req.userId from the session or replies 401. */
export function requireUser(resolveUserId: ResolveUserId) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: 'unauthorised' });
    req.userId = userId;
  };
}
