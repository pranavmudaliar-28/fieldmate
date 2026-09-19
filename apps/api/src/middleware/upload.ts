import { MAX_EVIDENCE_BYTES } from '@fieldmate/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { AppError } from '../utils/app-error.js';

export const PHOTO_FIELD = 'photo';

/**
 * Accepts exactly one photo, held in memory (docs/05 §7.17).
 * The file's real type is checked from its bytes by the evidence service.
 */
export const uploadPhoto: RequestHandler = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_EVIDENCE_BYTES, files: 1 },
}).single(PHOTO_FIELD);

/** Turns multer's own errors into the standard API error shape. */
export const uploadErrorHandler: ErrorRequestHandler = (err, _req, _res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      next(new AppError('INVALID_FILE', 'Photos must be 10 MB or smaller.'));
      return;
    }
    next(new AppError('INVALID_FILE', `Send exactly one photo in the "${PHOTO_FIELD}" field.`));
    return;
  }
  next(err);
};
