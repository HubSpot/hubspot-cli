import archiver from 'archiver';
import tmp, { FileResult } from 'tmp';
import fs from 'fs-extra';
import path from 'path';
import { uploadProject } from '@hubspot/local-dev-lib/api/projects';
import { shouldIgnoreFile } from '@hubspot/local-dev-lib/ignoreRules';

import SpinniesManager from '../ui/SpinniesManager';
import { uiAccountDescription } from '../ui';
import { EXIT_CODES } from '../enums/exitCodes';
import { ProjectConfig } from '../../types/Projects';
import {
  isTranslationError,
  translate,
  projectContainsHsMetaFiles,
} from '@hubspot/project-parsing-lib';
import { logError } from '../errorHandlers';
import util from 'node:util';
import { lib } from '../../lang/en';
import { ensureProjectExists } from './ensureProjectExists';
import { uiLogger } from '../ui/logger';
import { useV3Api } from './buildAndDeploy';

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
    text: lib.projectUpload.uploadProjectFiles.add(
      projectName,
      accountIdentifier
    ),
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
      text: lib.projectUpload.uploadProjectFiles.succeed(
        projectName,
        accountIdentifier
      ),
    });

    if (buildId) {
      uiLogger.debug(
        lib.projectUpload.uploadProjectFiles.buildCreated(projectName, buildId)
      );
    }
  } catch (err) {
    SpinniesManager.fail('upload', {
      text: lib.projectUpload.uploadProjectFiles.fail(
        projectName,
        accountIdentifier
      ),
    });

    error = err;
  }

  return { buildId, error };
}

type ProjectUploadCallbackFunction<T> = (
  accountId: number,
  projectConfig: ProjectConfig,
  tempFile: FileResult,
  buildId: number
) => Promise<T>;

type ProjectUploadResult<T> = {
  result?: T;
  uploadError?: unknown;
};

type HandleProjectUploadArg<T> = {
  accountId: number;
  projectConfig: ProjectConfig;
  projectDir: string;
  callbackFunc: ProjectUploadCallbackFunction<T>;
  uploadMessage?: string;
  forceCreate?: boolean;
  isUploadCommand?: boolean;
  sendIR?: boolean;
  skipValidation?: boolean;
  profile?: string;
};

export async function handleProjectUpload<T>({
  accountId,
  projectConfig,
  projectDir,
  callbackFunc,
  profile,
  uploadMessage = '',
  forceCreate = false,
  isUploadCommand = false,
  sendIR = false,
  skipValidation = false,
}: HandleProjectUploadArg<T>): Promise<ProjectUploadResult<T>> {
  const srcDir = path.resolve(projectDir, projectConfig.srcDir);

  const filenames = fs.readdirSync(srcDir);
  if (!filenames || filenames.length === 0) {
    uiLogger.log(
      lib.projectUpload.handleProjectUpload.emptySource(projectConfig.srcDir)
    );
    process.exit(EXIT_CODES.SUCCESS);
  }

  const hasHsMetaFiles = await projectContainsHsMetaFiles(srcDir);

  if (!useV3Api(projectConfig.platformVersion) && hasHsMetaFiles) {
    uiLogger.error(lib.projectUpload.wrongPlatformVersionMetaFiles);
    process.exit(EXIT_CODES.ERROR);
  }

  const tempFile = tmp.fileSync({ postfix: '.zip' });

  uiLogger.debug(
    lib.projectUpload.handleProjectUpload.compressing(tempFile.name)
  );

  const output = fs.createWriteStream(tempFile.name);
  const archive = archiver('zip');

  const result = new Promise<ProjectUploadResult<T>>(resolve =>
    output.on('close', async function () {
      uiLogger.debug(
        lib.projectUpload.handleProjectUpload.compressed(archive.pointer())
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
            { skipValidation, profile }
          );

          uiLogger.debug(
            util.inspect(intermediateRepresentation, false, null, true)
          );
        } catch (e) {
          if (isTranslationError(e)) {
            uiLogger.error(e.toString());
          } else {
            logError(e);
          }
          return process.exit(EXIT_CODES.ERROR);
        }
      }

      await ensureProjectExists(accountId, projectConfig.name, {
        forceCreate,
        uploadCommand: isUploadCommand,
      });

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
          buildId!
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
        uiLogger.debug(
          lib.projectUpload.handleProjectUpload.fileFiltered(file.name)
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
