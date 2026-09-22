/**
 * There is no file system to stat in a browser: the photo is a blob: or data:
 * URL held by the page, so the only way to its length is to read it back.
 */
export async function photoByteSize(uri: string): Promise<number> {
  const response = await fetch(uri);
  return (await response.blob()).size;
}
