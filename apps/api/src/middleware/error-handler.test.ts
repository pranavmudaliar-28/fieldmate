import { describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { silentLogger } from '../../test/helpers/config.js';
import { AppError } from '../utils/app-error.js';
import { errorHandler } from './error-handler.js';

function appThrowing(error: unknown) {
  const app = express();
  app.get('/boom', () => {
    throw error;
  });
  app.get('/async-boom', async () => {
    await Promise.resolve();
    throw error;
  });
  app.use(errorHandler(silentLogger));
  return app;
}

describe('errorHandler', () => {
  it('maps AppError to its status and code', async () => {
    const res = await request(
      appThrowing(new AppError('TASK_NOT_FOUND', 'Task was not found.')),
    ).get('/boom');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'TASK_NOT_FOUND', message: 'Task was not found.' } });
  });

  it('handles errors thrown from async handlers (Express 5)', async () => {
    const res = await request(
      appThrowing(new AppError('INVALID_STATUS_TRANSITION', 'Not allowed.')),
    ).get('/async-boom');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('hides unexpected errors behind a generic 500', async () => {
    const res = await request(
      appThrowing(new Error('connect ECONNREFUSED postgres://user:secret@db:5432')),
    ).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' },
    });
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });
});
