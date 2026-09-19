import { AppError } from './app-error.js';

export type TaskCursor = {
  updatedAt: Date;
  id: string;
};

const SEPARATOR = '|';

/** Opaque keyset cursor over (updated_at, id) — docs/05 §6. */
export function encodeCursor(cursor: TaskCursor): string {
  return Buffer.from(`${cursor.updatedAt.toISOString()}${SEPARATOR}${cursor.id}`).toString(
    'base64url',
  );
}

export function decodeCursor(value: string): TaskCursor {
  const invalid = () => new AppError('INVALID_REQUEST', 'The page cursor is not valid.');

  let decoded: string;
  try {
    decoded = Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    throw invalid();
  }

  const [timestamp, id, ...rest] = decoded.split(SEPARATOR);
  if (!timestamp || !id || rest.length > 0) throw invalid();

  const updatedAt = new Date(timestamp);
  if (Number.isNaN(updatedAt.getTime())) throw invalid();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw invalid();

  return { updatedAt, id };
}
