import type { EvidenceMimeType } from '@fieldmate/shared';

/** Object storage for field evidence. The bucket is private (docs/03 §9). */
export type StorageService = {
  /** Uploads an object and resolves once it is stored. */
  putObject(key: string, body: Buffer, contentType: EvidenceMimeType): Promise<void>;
  /** Short-lived GET URL for viewing a photo. */
  getSignedUrl(key: string): Promise<string>;
  /** Best-effort delete; callers log failures rather than failing the request. */
  deleteObject(key: string): Promise<void>;
};

export function evidenceKey(
  taskId: string,
  evidenceId: string,
  mimeType: EvidenceMimeType,
): string {
  const extension = mimeType === 'image/png' ? 'png' : 'jpg';
  return `tasks/${taskId}/evidence/${evidenceId}.${extension}`;
}
