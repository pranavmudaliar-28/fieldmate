import { describe, expect, it } from '@jest/globals';
import { detectImageType } from './image-type.js';

const jpeg = (extra: number[] = []) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...extra]);
const png = (extra: number[] = []) =>
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...extra]);

describe('detectImageType', () => {
  it('detects JPEG and PNG from their signatures', () => {
    expect(detectImageType(jpeg())).toBe('image/jpeg');
    expect(detectImageType(png())).toBe('image/png');
  });

  it('ignores trailing content', () => {
    expect(detectImageType(jpeg([1, 2, 3, 4, 5]))).toBe('image/jpeg');
    expect(detectImageType(png([9, 9, 9]))).toBe('image/png');
  });

  it.each([
    ['GIF', Buffer.from('GIF89a')],
    ['PDF', Buffer.from('%PDF-1.7')],
    ['plain text', Buffer.from('not an image at all')],
    ['empty', Buffer.alloc(0)],
    ['truncated JPEG signature', Buffer.from([0xff, 0xd8])],
    ['almost PNG', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00])],
  ])('rejects %s', (_case, buffer) => {
    expect(detectImageType(buffer)).toBeNull();
  });

  it('rejects a file that only claims to be an image by name', () => {
    expect(detectImageType(Buffer.from('photo.jpg'))).toBeNull();
  });
});
