import archiver from 'archiver';
import tmp, { FileResult } from 'tmp';
import fs from 'fs-extra';
import path from 'path';
import { uploadProject } from '@hubspot/local-dev-lib/api/projects';
import { shouldIgnoreFile } from '@hubspot/local-dev-lib/ignoreRules';
import { logger } from '@hubspot/local-dev-lib/logger';

import SpinniesManager from '../ui/SpinniesManager';
import { uiAccountDescription } from '../ui';
import { i18n } from '../lang';
import { EXIT_CODES } from '../enums/exitCodes';
import { ProjectConfig } from '../../types/Projects';
import { isTranslationError, translate } from '@hubspot/project-parsing-lib';
import { logError } from '../errorHandlers';
import util from 'node:util';


async function uploadProjectFiles(
  accountId: number,
  projectName: string,
  filePath: string,
  uploadMessage: string,
  platformVersion: string,
  intermediateRepresentation?: unknown
): Promise<{ buildId?: number; error: unknown }> {
  SpinniesManager.init({});
  const accountIdentifier = uiAccountDescription(accountId);

  SpinniesManager.add('upload', {
    text: i18n(`lib.projectUpload.uploadProjectFiles.add`, {
      accountIdentifier,
      projectName,
    }),
    succeedColor: 'white',
  });

  let buildId: number | undefined;
  let error: unknown;

  try {
    const { data: upload } = await uploadProject(
      accountId,
      projectName,
      filePath,
      uploadMessage,
      platformVersion,
      intermediateRepresentation
    );

    buildId = upload.buildId;

    SpinniesManager.succeed('upload', {
      text: i18n(`lib.projectUpload.uploadProjectFiles.succeed`, {
        accountIdentifier,
        projectName,
      }),
    });

    if (buildId) {
      logger.debug(
        i18n(`lib.projectUpload.uploadProjectFiles.buildCreated`, {
          buildId,
          projectName,
        })
      );
    }
  } catch (err) {
    SpinniesManager.fail('upload', {
      text: i18n(`lib.projectUpload.uploadProjectFiles.fail`, {
        accountIdentifier,
        projectName,
      }),
    });

    error = err;
  }

  return { buildId, error };
}

type ProjectUploadCallbackFunction<T> = (
  accountId: number,
  projectConfig: ProjectConfig,
  tempFile: FileResult,
  buildId?: number
) => Promise<T>;

type ProjectUploadResult<T> = {
  result?: T;
  uploadError?: unknown;
};

export async function handleProjectUpload<T>(
  accountId: number,
  projectConfig: ProjectConfig,
  projectDir: string,
  callbackFunc: ProjectUploadCallbackFunction<T>,
  uploadMessage: string,
  sendIR: boolean = false,
  skipValidation: boolean = false
): Promise<ProjectUploadResult<T>> {
  const srcDir = path.resolve(projectDir, projectConfig.srcDir);

  const filenames = fs.readdirSync(srcDir);
  if (!filenames || filenames.length === 0) {
    logger.log(
      i18n(`lib.projectUpload.handleProjectUpload.emptySource`, {
        srcDir: projectConfig.srcDir,
      })
    );
    process.exit(EXIT_CODES.SUCCESS);
  }

  const tempFile = tmp.fileSync({ postfix: '.zip' });

  logger.debug(
    i18n(`lib.projectUpload.handleProjectUpload.compressing`, {
      path: tempFile.name,
    })
  );

  const output = fs.createWriteStream(tempFile.name);
  const archive = archiver('zip');

  const result = new Promise<ProjectUploadResult<T>>(resolve =>
    output.on('close', async function () {
      logger.debug(
        i18n(`lib.projectUpload.handleProjectUpload.compressed`, {
          byteCount: archive.pointer(),
        })
      );

      let intermediateRepresentation;

      if (sendIR) {
        try {
          intermediateRepresentation = await translate(
            {
              projectSourceDir: path.join(projectDir, projectConfig.srcDir),
              platformVersion: projectConfig.platformVersion,
              accountId,
            },
            { skipValidation }
          );

          logger.debug(
            util.inspect(intermediateRepresentation, false, null, true)
          );
        } catch (e) {
          if (isTranslationError(e)) {
            logger.error(e.toString());
          } else {
            logError(e);
          }
          return process.exit(EXIT_CODES.ERROR);
        }
      }

      const { buildId, error } = await uploadProjectFiles(
        accountId,
        projectConfig.name,
        tempFile.name,
        uploadMessage,
        projectConfig.platformVersion,
        intermediateRepresentation
      );

      if (error) {
        resolve({ uploadError: error });
      } else if (callbackFunc) {
        const uploadResult = await callbackFunc(
          accountId,
          projectConfig,
          tempFile,
          buildId
        );
        resolve({ result: uploadResult });
      }
    })
  );

  archive.pipe(output);

  let loggedIgnoredNodeModule = false;

  archive.directory(srcDir, false, file => {
    const ignored = shouldIgnoreFile(file.name, true);
    if (ignored) {
      const isNodeModule = file.name.includes('node_modules');

      if (!isNodeModule || !loggedIgnoredNodeModule) {
        logger.debug(
          i18n(`lib.projectUpload.handleProjectUpload.fileFiltered`, {
            filename: file.name,
          })
        );
      }

      if (isNodeModule && !loggedIgnoredNodeModule) {
        loggedIgnoredNodeModule = true;
      }
    }
    return ignored ? false : file;
  });

  archive.finalize();

  return result;
}
