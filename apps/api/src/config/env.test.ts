import { describe, expect, it } from '@jest/globals';
import { ConfigError, loadConfig } from './env.js';

const base = {
  APP_ENV: 'development',
  DATABASE_URL: 'postgres://fieldmate:fieldmate@localhost:5432/fieldmate_dev',
  AUTH_SECRET: 'a'.repeat(32),
  FILE_STORAGE_ENDPOINT: 'http://localhost:9000',
  FILE_STORAGE_BUCKET: 'fieldmate-dev',
  FILE_STORAGE_ACCESS_KEY_ID: 'key',
  FILE_STORAGE_SECRET_ACCESS_KEY: 'secret',
  FILE_STORAGE_FORCE_PATH_STYLE: 'true',
};

const remote = {
  ...base,
  APP_ENV: 'production',
  DATABASE_URL: 'postgres://user:pass@db.example.com:5432/fieldmate',
  FILE_STORAGE_ENDPOINT: '',
  FILE_STORAGE_FORCE_PATH_STYLE: 'false',
};

describe('loadConfig', () => {
  it('parses a valid development configuration with defaults', () => {
    const config = loadConfig(base);
    expect(config).toMatchObject({
      appEnv: 'development',
      port: 3000,
      logLevel: 'info',
      corsOrigins: [],
      storage: { endpoint: 'http://localhost:9000', region: 'us-east-1', forcePathStyle: true },
      push: { expoAccessToken: undefined },
    });
  });

  it('splits CORS origins and treats an empty storage endpoint as AWS', () => {
    const config = loadConfig({ ...remote, CORS_ORIGINS: 'https://a.example, https://b.example' });
    expect(config.corsOrigins).toEqual(['https://a.example', 'https://b.example']);
    expect(config.storage.endpoint).toBeUndefined();
  });

  it('lists missing variables without exposing values', () => {
    const { AUTH_SECRET: _secret, DATABASE_URL: _db, ...rest } = base;
    expect(() => loadConfig(rest)).toThrow(ConfigError);
    try {
      loadConfig(rest);
    } catch (error) {
      expect((error as Error).message).toContain('AUTH_SECRET');
      expect((error as Error).message).toContain('DATABASE_URL');
    }
  });

  it('rejects a short AUTH_SECRET', () => {
    expect(() => loadConfig({ ...base, AUTH_SECRET: 'short' })).toThrow(/AUTH_SECRET/);
  });

  it('rejects an unknown APP_ENV', () => {
    expect(() => loadConfig({ ...base, APP_ENV: 'prod' })).toThrow(ConfigError);
  });

  it('accepts a production configuration with remote services', () => {
    expect(loadConfig(remote).appEnv).toBe('production');
  });

  it.each(['staging', 'production'])('refuses a local database in %s', (appEnv) => {
    expect(() =>
      loadConfig({ ...remote, APP_ENV: appEnv, DATABASE_URL: base.DATABASE_URL }),
    ).toThrow(/DATABASE_URL must not point to a local host/);
  });

  it('refuses local storage in production', () => {
    expect(() => loadConfig({ ...remote, FILE_STORAGE_ENDPOINT: 'http://127.0.0.1:9000' })).toThrow(
      /FILE_STORAGE_ENDPOINT must not point to a local host/,
    );
  });
});
