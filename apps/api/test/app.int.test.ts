import { afterAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createTestApp } from './helpers/app.js';
import { closeTestDb } from './helpers/db.js';

const app = createTestApp();

afterAll(closeTestDb);

describe('app foundation', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('returns the standard error shape for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Resource was not found.' } });
  });

  it('returns 400 INVALID_REQUEST for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });

  it('rejects JSON bodies over 100kb', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(110_000) }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });

  it('sets security headers and hides the framework', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('does not send CORS headers when no origins are configured', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows configured CORS origins', async () => {
    const corsApp = createTestApp({ corsOrigins: ['https://admin.example'] });
    const res = await request(corsApp).get('/health').set('Origin', 'https://admin.example');
    expect(res.headers['access-control-allow-origin']).toBe('https://admin.example');
  });
});
