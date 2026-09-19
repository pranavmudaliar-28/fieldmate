import type { EvidenceMimeType } from '@fieldmate/shared';

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(buffer: Buffer, signature: number[]): boolean {
  if (buffer.length < signature.length) return false;
  return signature.every((byte, index) => buffer[index] === byte);
}

/**
 * Detects the image type from the file's own bytes, never from the
 * client-supplied content type (docs/03 §9). Only JPEG and PNG are accepted,
 * so a two-signature check replaces a dependency.
 */
export function detectImageType(buffer: Buffer): EvidenceMimeType | null {
  if (startsWith(buffer, JPEG_SIGNATURE)) return 'image/jpeg';
  if (startsWith(buffer, PNG_SIGNATURE)) return 'image/png';
  return null;
}
