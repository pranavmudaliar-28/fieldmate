import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { schema } from './schema.js';

export type Database = NodePgDatabase<typeof schema>;

export type DbHandle = {
  db: Database;
  pool: pg.Pool;
  close: () => Promise<void>;
};

export function createDb(databaseUrl: string, options: { max?: number } = {}): DbHandle {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: options.max ?? 10 });
  const db = drizzle(pool, { schema });
  return {
    db,
    pool,
    close: () => pool.end(),
  };
}
