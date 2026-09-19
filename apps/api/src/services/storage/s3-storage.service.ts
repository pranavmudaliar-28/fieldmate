import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl as presign } from '@aws-sdk/s3-request-presigner';
import type { EvidenceMimeType } from '@fieldmate/shared';
import type { AppConfig } from '../../config/env.js';
import type { StorageService } from './storage.service.js';

/** Photo links expire quickly; the bucket itself is never public (docs/03 §9). */
export const SIGNED_URL_TTL_SECONDS = 15 * 60;

export function createS3StorageService(config: AppConfig): StorageService {
  const { storage } = config;
  const client = new S3Client({
    region: storage.region,
    forcePathStyle: storage.forcePathStyle,
    ...(storage.endpoint ? { endpoint: storage.endpoint } : {}),
    credentials: {
      accessKeyId: storage.accessKeyId,
      secretAccessKey: storage.secretAccessKey,
    },
  });

  return {
    async putObject(key, body, contentType: EvidenceMimeType) {
      await client.send(
        new PutObjectCommand({
          Bucket: storage.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    },

    getSignedUrl(key) {
      return presign(client, new GetObjectCommand({ Bucket: storage.bucket, Key: key }), {
        expiresIn: SIGNED_URL_TTL_SECONDS,
      });
    },

    async deleteObject(key) {
      await client.send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: key }));
    },
  };
}
