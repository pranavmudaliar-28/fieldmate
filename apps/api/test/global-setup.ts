import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

/**
 * Migrates the test database once before the integration suite runs.
 *
 * Jest loads globalSetup natively, so this file must not import project modules
 * through the ".js" specifiers that the test moduleNameMapper rewrites.
 */
export default async function globalSetup(): Promise<void> {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ?? 'postgres://fieldmate:fieldmate@localhost:5432/fieldmate_test';
  const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });

  try {
    await migrate(drizzle(pool), { migrationsFolder });
  } catch (error) {
    throw new Error(
      `Could not prepare the test database at ${databaseUrl}.\n` +
        'Start local services first: docker compose up -d',
      { cause: error },
    );
  } finally {
    await pool.end();
  }
}
