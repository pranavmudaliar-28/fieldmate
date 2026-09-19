import pg from 'pg';
import { runMigrations } from './migrate.js';

/**
 * Drops and recreates the public schema, then migrates.
 * Destructive: allowed only in development and test.
 */
const appEnv = process.env.APP_ENV;
const databaseUrl = process.env.DATABASE_URL;

if (appEnv !== 'development' && appEnv !== 'test') {
  console.error(
    `Refusing to reset the database: APP_ENV is "${appEnv ?? 'unset'}". ` +
      'Only development and test may be reset.',
  );
  process.exit(1);
}

if (!databaseUrl) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
try {
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
  // Drizzle keeps its migration journal in a separate "drizzle" schema; dropping
  // only "public" would leave migrations marked as applied against empty tables.
  await pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
  await pool.query('CREATE SCHEMA public');
} finally {
  await pool.end();
}

await runMigrations(databaseUrl);
console.log(`Database reset and migrated (${appEnv}).`);
