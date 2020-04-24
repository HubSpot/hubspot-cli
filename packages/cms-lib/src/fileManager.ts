import path = require('path');

import { uploadFile } from './api/fileManager';
import { walk } from './lib/walk';
import { logger } from './logger';
import { createIgnoreFilter } from './ignoreRules';
import escapeRegExp from './lib/escapeRegExp';
import { convertToUnixPath } from './path';
import {
  ApiErrorContext,
  logApiUploadErrorInstance,
  isFatalError,
} from './errorHandlers';

/**
 *
 * @param {number} portalId
 * @param {string} src
 * @param {string} dest
 * @param {object} options
 */
export async function uploadFolder(portalId, src, dest, { cwd }) {
  const regex = new RegExp(`^${escapeRegExp(src)}`);
  const files = await walk(src);

  const filesToUpload = files.filter(createIgnoreFilter(cwd));

  const len = filesToUpload.length;
  for (let index = 0; index < len; index++) {
    const file = filesToUpload[index];
    const relativePath = file.replace(regex, '');
    const destPath = convertToUnixPath(path.join(dest, relativePath));
    logger.debug('Attempting to upload file "%s" to "%s"', file, destPath);
    try {
      await uploadFile(portalId, file, destPath);
      logger.log('Uploaded file "%s" to "%s"', file, destPath);
    } catch (error) {
      logger.error('Uploading file "%s" to "%s" failed', file, destPath);
      if (isFatalError(error)) {
        throw error;
      }
      logApiUploadErrorInstance(
        error,
        new ApiErrorContext({
          portalId,
          request: destPath,
          payload: file,
        })
      );
    }
  }
}
