import { MAX_EVIDENCE_BYTES, type Evidence } from '@fieldmate/shared';
import { env } from '../../lib/env';
import { ApiError, NETWORK_ERROR_MESSAGE, getAuthToken } from '../../services/http';
import { photoFormData } from './photo-body';

export const PHOTO_TOO_LARGE_MESSAGE = 'This photo is too large. Take it again.';
export const PHOTO_UNREADABLE_MESSAGE = "Couldn't read that photo. Take it again.";

export type UploadProgress = (fraction: number) => void;

/**
 * Uploads one photo. XMLHttpRequest is used instead of fetch because it is the
 * only way to report upload progress in React Native (docs/03 §2.3).
 */
export function uploadEvidence(
  taskId: string,
  photo: { uri: string; mimeType: 'image/jpeg' | 'image/png'; size: number },
  onProgress?: UploadProgress,
): Promise<Evidence> {
  if (photo.size > MAX_EVIDENCE_BYTES) {
    return Promise.reject(new ApiError('INVALID_FILE', PHOTO_TOO_LARGE_MESSAGE));
  }

  return new Promise<Evidence>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${env.apiBaseUrl}/tasks/${taskId}/evidence`);
    const token = getAuthToken();
    if (token) request.setRequestHeader('Authorization', `Bearer ${token}`);
    request.setRequestHeader('Accept', 'application/json');

    request.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(event.loaded / event.total);
    };

    request.onload = () => {
      let payload: unknown;
      try {
        payload = JSON.parse(request.responseText) as unknown;
      } catch {
        // A non-JSON body is handled by the error mapping below.
        payload = null;
      }

      if (request.status >= 200 && request.status < 300) {
        resolve(payload as Evidence);
        return;
      }

      const body = payload as { error?: { code?: string; message?: string } } | null;
      reject(
        new ApiError(
          (body?.error?.code as ApiError['code']) ?? 'INTERNAL_ERROR',
          body?.error?.message ?? 'Something went wrong. Please try again.',
          request.status,
        ),
      );
    };

    request.onerror = () => reject(new ApiError('NETWORK_ERROR', NETWORK_ERROR_MESSAGE));
    request.onabort = () => reject(new ApiError('NETWORK_ERROR', NETWORK_ERROR_MESSAGE));

    // The body is platform-specific and the browser has to read the photo
    // back before it can be sent, so it is built after the request is wired up.
    void photoFormData({
      uri: photo.uri,
      mimeType: photo.mimeType,
      name: photo.mimeType === 'image/png' ? 'photo.png' : 'photo.jpg',
    }).then(
      (form) => request.send(form),
      () => reject(new ApiError('INVALID_FILE', PHOTO_UNREADABLE_MESSAGE)),
    );
  });
}
