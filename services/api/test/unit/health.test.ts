import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

describe('GET /health', () => {
  it('returns ok', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });
});

describe('buildApp without a session resolver', () => {
  it('fails loudly in production', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() => buildApp()).toThrow(/session resolver/);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
