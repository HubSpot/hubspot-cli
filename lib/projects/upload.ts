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

const i18nKey = 'lib.projectUpload';

async function uploadProjectFiles(
  accountId: number,
  projectName: string,
  filePath: string,
  uploadMessage: string,
  platformVersion: string
): Promise<{ buildId?: number; error: unknown }> {
  SpinniesManager.init({});
  const accountIdentifier = uiAccountDescription(accountId);

  SpinniesManager.add('upload', {
    text: i18n(`${i18nKey}.uploadProjectFiles.add`, {
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
      platformVersion
    );

    buildId = upload.buildId;

    SpinniesManager.succeed('upload', {
      text: i18n(`${i18nKey}.uploadProjectFiles.succeed`, {
        accountIdentifier,
        projectName,
      }),
    });

    logger.debug(
      i18n(`${i18nKey}.uploadProjectFiles.buildCreated`, {
        buildId,
        projectName,
      })
    );
  } catch (err) {
    SpinniesManager.fail('upload', {
      text: i18n(`${i18nKey}.uploadProjectFiles.fail`, {
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
) => Promise<T | undefined>;

type ProjectUploadDefaultResult = {
  uploadError?: unknown;
};

export async function handleProjectUpload<T = ProjectUploadDefaultResult>(
  accountId: number,
  projectConfig: ProjectConfig,
  projectDir: string,
  callbackFunc: ProjectUploadCallbackFunction<T>,
  uploadMessage: string
) {
  const srcDir = path.resolve(projectDir, projectConfig.srcDir);

  const filenames = fs.readdirSync(srcDir);
  if (!filenames || filenames.length === 0) {
    logger.log(
      i18n(`${i18nKey}.handleProjectUpload.emptySource`, {
        srcDir: projectConfig.srcDir,
      })
    );
    process.exit(EXIT_CODES.SUCCESS);
  }

  const tempFile = tmp.fileSync({ postfix: '.zip' });

  logger.debug(
    i18n(`${i18nKey}.handleProjectUpload.compressing`, {
      path: tempFile.name,
    })
  );

  const output = fs.createWriteStream(tempFile.name);
  const archive = archiver('zip');

  const result = new Promise(resolve =>
    output.on('close', async function () {
      let uploadResult: ProjectUploadDefaultResult | T | undefined;

      logger.debug(
        i18n(`${i18nKey}.handleProjectUpload.compressed`, {
          byteCount: archive.pointer(),
        })
      );

      const { buildId, error } = await uploadProjectFiles(
        accountId,
        projectConfig.name,
        tempFile.name,
        uploadMessage,
        projectConfig.platformVersion
      );

      if (error) {
        console.log(error);
        uploadResult = { uploadError: error };
      } else if (callbackFunc) {
        uploadResult = await callbackFunc(
          accountId,
          projectConfig,
          tempFile,
          buildId
        );
      }
      resolve(uploadResult || {});
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
          i18n(`${i18nKey}.handleProjectUpload.fileFiltered`, {
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
