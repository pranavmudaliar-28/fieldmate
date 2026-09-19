import { pino, type Logger } from 'pino';
import type { AppConfig } from './env.js';

export type { Logger };

export function createLogger(level: AppConfig['logLevel']): Logger {
  return pino({
    level,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        '*.password',
        '*.passwordHash',
        '*.token',
        '*.authSecret',
        '*.secretAccessKey',
      ],
      censor: '[REDACTED]',
    },
  });
}
