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

/**
 * Names a note or photo the server will keep. The server takes it as the row's
 * id, so a write replayed after its response was lost is recognised rather
 * than stored twice. Not a secret: the server checks who owns an id it has seen.
 */
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
