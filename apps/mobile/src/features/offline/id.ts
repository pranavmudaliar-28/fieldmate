let counter = 0;

/**
 * Names a queue entry and the photo file beside it.
 *
 * Deliberately not a UUID: these ids never leave the device and never reach
 * the database, so they only have to be unique among one worker's unsent
 * writes. The timestamp keeps them sorted if they are ever read raw, and the
 * counter separates two made in the same millisecond.
 */
export function localId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}
