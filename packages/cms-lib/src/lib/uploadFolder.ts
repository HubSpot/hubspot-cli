import path = require('path');
import { default as PQueue } from 'p-queue';

import { logger } from '../logger';
import { getFileMapperApiQueryFromMode } from '../fileMapper';
import { upload } from '../api/fileMapper';
import { createIgnoreFilter } from '../ignoreRules';
import { walk } from './walk';
import escapeRegExp from './escapeRegExp';
import {
  convertToUnixPath,
  isAllowedExtension,
  getExt,
  splitLocalPath,
} from '../path';
import {
  ApiErrorContext,
  logApiUploadErrorInstance,
  isFatalError,
} from '../errorHandlers';

const queue = new PQueue({
  concurrency: 10,
});

function getFilesByType(files) {
  const moduleFiles = [];
  const cssAndJsFiles = [];
  const otherFiles = [];
  const templateFiles = [];

  files.forEach(file => {
    const parts = splitLocalPath(file);
    const extension = getExt(file);

    const moduleFolder = parts.find(part => part.endsWith('.module'));
    if (moduleFolder) {
      moduleFiles.push(file);
    } else if (extension === 'js' || extension === 'css') {
      cssAndJsFiles.push(file);
    } else if (extension === 'html') {
      templateFiles.push(file);
    } else {
      otherFiles.push(file);
    }
  });

  return [otherFiles, moduleFiles, cssAndJsFiles, templateFiles];
}
/**
 *
 * @param {number} portalId
 * @param {string} src
 * @param {string} dest
 * @param {object} options
 */
export async function uploadFolder(portalId, src, dest, { mode, cwd }) {
  const regex = new RegExp(`^${escapeRegExp(src)}`);
  const apiOptions = {
    qs: getFileMapperApiQueryFromMode(mode),
  };
  const files = await walk(src);

  const allowedFiles = files
    .filter(file => {
      if (!isAllowedExtension(file)) {
        return false;
      }
      return true;
    })
    .filter(createIgnoreFilter(cwd));

  const filesByType = getFilesByType(allowedFiles);

  const failures = [];

  const uploadFile = file => {
    const relativePath = file.replace(regex, '');
    const destPath = convertToUnixPath(path.join(dest, relativePath));
    return async () => {
      logger.debug('Attempting to upload file "%s" to "%s"', file, destPath);
      try {
        await upload(portalId, file, destPath, apiOptions);
        logger.log('Uploaded file "%s" to "%s"', file, destPath);
      } catch (error) {
        if (isFatalError(error)) {
          throw error;
        }
        logger.debug(
          'Uploading file "%s" to "%s" failed so scheduled retry',
          file,
          destPath
        );
        if (error.response && error.response.body) {
          logger.debug(error.response.body);
        } else {
          logger.debug(error.message);
        }
        failures.push({
          file,
          destPath,
        });
      }
    };
  };

  // Implemented using a for lop due to async/await
  for (let i = 0; i < filesByType.length; i++) {
    const filesToUpload = filesByType[i];
    await queue.addAll(filesToUpload.map(uploadFile));
  }

  return queue.addAll(
    failures.map(({ file, destPath }) => {
      return async () => {
        logger.debug('Retrying to upload file "%s" to "%s"', file, destPath);
        try {
          await upload(portalId, file, destPath, apiOptions);
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
      };
    })
  );
}
