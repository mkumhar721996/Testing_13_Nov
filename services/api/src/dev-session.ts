import type { ResolveUserId } from './auth.js';

export const devUserId = '00000000-0000-4000-8000-0000000000d1';

/**
 * Local-development stand-in for sessions until the accounts story lands: everyone is one fixed user.
 * Never provided in production, where buildApp refuses to start without a real resolver.
 */
export function devResolveUserId(env: { NODE_ENV?: string }): ResolveUserId | undefined {
  if (env.NODE_ENV === 'production') return undefined;
  return async () => devUserId;
}
