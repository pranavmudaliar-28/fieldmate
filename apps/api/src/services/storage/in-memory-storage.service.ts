import type { StorageService } from './storage.service.js';

export type InMemoryStorageService = StorageService & {
  objects: Map<string, { body: Buffer; contentType: string }>;
};

/** Test double for the S3 storage service. */
export function createInMemoryStorageService(): InMemoryStorageService {
  const objects = new Map<string, { body: Buffer; contentType: string }>();

  return {
    objects,
    async putObject(key, body, contentType) {
      objects.set(key, { body, contentType });
    },
    async getSignedUrl(key) {
      return `https://storage.test/${key}?signature=test`;
    },
    async deleteObject(key) {
      objects.delete(key);
    },
  };
}
