import { z } from 'zod';

export const APP_ENVS = ['development', 'staging', 'production', 'test'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

const envSchema = z.object({
  APP_ENV: z.enum(APP_ENVS),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url(),
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters.'),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  FILE_STORAGE_ENDPOINT: z.preprocess(emptyToUndefined, z.url().optional()),
  FILE_STORAGE_REGION: z.string().min(1).default('us-east-1'),
  FILE_STORAGE_BUCKET: z.string().min(1),
  FILE_STORAGE_ACCESS_KEY_ID: z.string().min(1),
  FILE_STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  FILE_STORAGE_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  PUSH_NOTIFICATION_EXPO_ACCESS_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
});

export type AppConfig = {
  appEnv: AppEnv;
  port: number;
  logLevel: z.output<typeof envSchema>['LOG_LEVEL'];
  databaseUrl: string;
  authSecret: string;
  corsOrigins: string[];
  storage: {
    endpoint: string | undefined;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
  };
  push: {
    expoAccessToken: string | undefined;
  };
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'host.docker.internal']);

function isLocalUrl(url: string): boolean {
  return LOCAL_HOSTS.has(new URL(url).hostname);
}

export class ConfigError extends Error {
  override name = 'ConfigError';
}

/**
 * Validates environment variables. Throws ConfigError with every problem listed
 * (names only; values are never included, so secrets are not logged).
 */
export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    throw new ConfigError(`Invalid environment configuration:\n- ${problems.join('\n- ')}`);
  }
  const e = result.data;

  if (e.APP_ENV === 'staging' || e.APP_ENV === 'production') {
    const problems: string[] = [];
    if (isLocalUrl(e.DATABASE_URL)) problems.push('DATABASE_URL must not point to a local host.');
    if (e.FILE_STORAGE_ENDPOINT && isLocalUrl(e.FILE_STORAGE_ENDPOINT))
      problems.push('FILE_STORAGE_ENDPOINT must not point to a local host.');
    if (problems.length > 0) {
      throw new ConfigError(`Invalid ${e.APP_ENV} configuration:\n- ${problems.join('\n- ')}`);
    }
  }

  return {
    appEnv: e.APP_ENV,
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    databaseUrl: e.DATABASE_URL,
    authSecret: e.AUTH_SECRET,
    corsOrigins: e.CORS_ORIGINS,
    storage: {
      endpoint: e.FILE_STORAGE_ENDPOINT,
      region: e.FILE_STORAGE_REGION,
      bucket: e.FILE_STORAGE_BUCKET,
      accessKeyId: e.FILE_STORAGE_ACCESS_KEY_ID,
      secretAccessKey: e.FILE_STORAGE_SECRET_ACCESS_KEY,
      forcePathStyle: e.FILE_STORAGE_FORCE_PATH_STYLE,
    },
    push: {
      expoAccessToken: e.PUSH_NOTIFICATION_EXPO_ACCESS_TOKEN,
    },
  };
}
