import { File } from 'expo-file-system';

/** A captured photo is a real file on device, so the file system knows its size. */
export async function photoByteSize(uri: string): Promise<number> {
  return new File(uri).size ?? 0;
}
