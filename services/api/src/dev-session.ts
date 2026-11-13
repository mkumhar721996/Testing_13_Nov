import type { ResolveUserId } from './auth.js';

export const devUserId = '00000000-0000-4000-8000-0000000000d1';

type Env = { NODE_ENV?: string; ALLOW_DEV_SESSION?: string; HOST?: string };

/**
 * Local-development stand-in for sessions until the accounts story lands: everyone is one fixed user.
 * Fails closed: only ALLOW_DEV_SESSION=1 turns it on, and never in production.
 */
export function devResolveUserId(env: Env): ResolveUserId | undefined {
  if (env.NODE_ENV === 'production' || env.ALLOW_DEV_SESSION !== '1') return undefined;
  return async () => devUserId;
}

/** Session resolver and bind address for server.ts; throws when there is no way to sign anyone in. */
export function serverSession(env: Env): { resolveUserId: ResolveUserId; host: string } {
  const resolveUserId = devResolveUserId(env);
  if (!resolveUserId) {
    throw new Error('No session resolver configured: wire the accounts story, or set ALLOW_DEV_SESSION=1 for local development');
  }
  // The dev session trusts every caller, so keep it on the loopback interface.
  return { resolveUserId, host: '127.0.0.1' };
}
