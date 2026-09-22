import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { photoByteSize } from './photo-size';

export const MAX_LONG_EDGE = 2048;
export const JPEG_QUALITY = 0.7;

export type PreparedPhoto = {
  uri: string;
  mimeType: 'image/jpeg';
  size: number;
};

/**
 * Resizes and re-encodes a captured photo before upload (docs/03 §2.3).
 * Re-encoding also drops EXIF data, including the GPS position.
 */
export async function preparePhoto(uri: string, width: number): Promise<PreparedPhoto> {
  const context = ImageManipulator.manipulate(uri);
  if (width > MAX_LONG_EDGE) context.resize({ width: MAX_LONG_EDGE });

  const image = await context.renderAsync();
  const result = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });

  return {
    uri: result.uri,
    mimeType: 'image/jpeg',
    size: await photoByteSize(result.uri),
  };
}
