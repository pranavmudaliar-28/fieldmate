/** Shared helpers for the CLI scripts. */

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** Innermost cause of a wrapped driver error (Drizzle wraps the Postgres error). */
export function rootCauseMessage(error: unknown): string {
  let current: unknown = error;
  while (current instanceof Error && current.cause instanceof Error) {
    current = current.cause;
  }
  return current instanceof Error ? current.message : String(current);
}

/**
 * Runs a script body and prints a short error instead of a stack trace.
 * A missing table means migrations have not been applied yet.
 */
export async function runScript(body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } catch (error) {
    const message = rootCauseMessage(error);
    if (/relation .* does not exist/.test(message)) {
      fail(
        `${message}\nThe database schema is missing. Apply migrations first:\n` +
          '  npm run db:migrate -w @fieldmate/api',
      );
    }
    fail(message);
  }
}
