import archiver from 'archiver';
import tmp, { FileResult } from 'tmp';
import fs from 'fs-extra';
import path from 'path';
import { uploadProject } from '@hubspot/local-dev-lib/api/projects';
import { shouldIgnoreFile } from '@hubspot/local-dev-lib/ignoreRules';
import {
  isTranslationError,
  translate,
} from '@hubspot/project-parsing-lib/translate';
import { projectContainsHsMetaFiles } from '@hubspot/project-parsing-lib/projects';
import {
  findAndParsePackageJsonFiles,
  collectWorkspaceDirectories,
  collectFileDependencies,
} from '@hubspot/project-parsing-lib/workspaces';

import SpinniesManager from '../ui/SpinniesManager.js';
import { uiAccountDescription } from '../ui/index.js';
import { ProjectConfig } from '../../types/Projects.js';

import util from 'node:util';
import { lib } from '../../lang/en.js';
import { ensureProjectExists } from './ensureProjectExists.js';
import { uiLogger } from '../ui/logger.js';
import ProjectValidationError from '../errors/ProjectValidationError.js';
import { walk } from '@hubspot/local-dev-lib/fs';
import { LEGACY_CONFIG_FILES } from '../constants.js';
import {
  archiveWorkspacesAndDependencies,
  getPackageJsonPathsToUpdate,
  getLockfilePathsToUpdate,
} from './workspaces.js';
import { isLegacyProject } from '@hubspot/project-parsing-lib/projects';

async function uploadProjectFiles(
  accountId: number,
  projectName: string,
  filePath: string,
  uploadMessage: string,
  platformVersion: string,
  intermediateRepresentation?: unknown
): Promise<{ buildId?: number; error: unknown }> {
  const accountIdentifier = uiAccountDescription(accountId) || `${accountId}`;

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
  projectNotFound?: boolean;
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

  await validateSourceDirectory(srcDir, projectConfig, projectDir);
  await validateNoHSMetaMismatch(srcDir, projectConfig);

  const tempFile = tmp.fileSync({ postfix: '.zip' });

  uiLogger.debug(
    lib.projectUpload.handleProjectUpload.compressing(tempFile.name)
  );

  // Collect workspace directories and file: dependencies for v2+ projects only.
  // Versions <= 2025.1 do not support the new npm workspaces bundling behavior.
  let workspaceMappings: Awaited<
    ReturnType<typeof collectWorkspaceDirectories>
  > = [];
  let fileDependencyMappings: Awaited<
    ReturnType<typeof collectFileDependencies>
  > = [];

  if (!isLegacyProject(projectConfig.platformVersion)) {
    const parsedPackageJsons = await findAndParsePackageJsonFiles(srcDir);
    workspaceMappings = await collectWorkspaceDirectories(parsedPackageJsons);
    fileDependencyMappings = await collectFileDependencies(parsedPackageJsons);
  }

  const output = fs.createWriteStream(tempFile.name);
  const archive = archiver('zip');

  const result = new Promise<ProjectUploadResult<T>>((resolve, reject) =>
    output.on('close', async function () {
      try {
        uiLogger.debug(
          lib.projectUpload.handleProjectUpload.compressed(archive.pointer())
        );

        let intermediateRepresentation;

        if (sendIR) {
          try {
            intermediateRepresentation = await handleTranslate({
              projectDir,
              projectConfig,
              accountId,
              skipValidation,
              profile,
            });
          } catch (e) {
            return resolve({ uploadError: e });
          }
        }

        const { projectExists } = await ensureProjectExists(
          accountId,
          projectConfig.name,
          {
            forceCreate,
            uploadCommand: isUploadCommand,
            noLogs: true,
          }
        );

        if (!projectExists) {
          uiLogger.log(
            lib.projectUpload.handleProjectUpload.projectDoesNotExist(accountId)
          );
          return resolve({ projectNotFound: true });
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
            buildId!
          );
          resolve({ result: uploadResult });
        }
      } catch (e) {
        reject(e);
      }
    })
  );

  archive.pipe(output);

  const modifiedPackageJsonPaths = getPackageJsonPathsToUpdate(
    srcDir,
    workspaceMappings,
    fileDependencyMappings
  );

  const lockfilePathsToUpdate = getLockfilePathsToUpdate(
    srcDir,
    workspaceMappings,
    fileDependencyMappings
  );

  let loggedIgnoredNodeModule = false;

  archive.directory(srcDir, false, file => {
    if (
      modifiedPackageJsonPaths.has(file.name) ||
      lockfilePathsToUpdate.has(file.name)
    ) {
      return false;
    }

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

  // Archive workspaces and file: dependencies
  await archiveWorkspacesAndDependencies(
    archive,
    srcDir,
    projectDir,
    workspaceMappings,
    fileDependencyMappings
  );

  archive.finalize();

  return result;
}

export async function validateSourceDirectory(
  srcDir: string,
  projectConfig: ProjectConfig,
  projectDir: string
) {
  const projectFilePaths = await walk(srcDir, ['node_modules']);
  if (!projectFilePaths || projectFilePaths.length === 0) {
    throw new ProjectValidationError(
      lib.projectUpload.handleProjectUpload.emptySource(projectConfig.srcDir)
    );
  }

  if (!isLegacyProject(projectConfig.platformVersion)) {
    projectFilePaths.forEach(filePath => {
      const filename = path.basename(filePath);
      if (LEGACY_CONFIG_FILES.includes(filename)) {
        uiLogger.warn(
          lib.projectUpload.handleProjectUpload.legacyFileDetected(
            path.relative(projectDir, filePath),
            projectConfig.platformVersion
          )
        );
      }
    });
  }
}

export async function validateNoHSMetaMismatch(
  srcDir: string,
  projectConfig: ProjectConfig
) {
  const hasHsMetaFiles = await projectContainsHsMetaFiles(srcDir);
  if (isLegacyProject(projectConfig.platformVersion) && hasHsMetaFiles) {
    throw new ProjectValidationError(
      lib.projectUpload.wrongPlatformVersionMetaFiles
    );
  }
}

type HandleTranslateArg = {
  projectDir: string;
  projectConfig: ProjectConfig;
  accountId: number;
  skipValidation: boolean;
  profile?: string;
  includeTranslationErrorMessage?: boolean;
};

export async function handleTranslate({
  projectDir,
  projectConfig,
  accountId,
  skipValidation,
  profile,
  includeTranslationErrorMessage = true,
}: HandleTranslateArg): Promise<unknown> {
  try {
    const intermediateRepresentation = await translate(
      {
        projectSourceDir: path.join(projectDir, projectConfig.srcDir),
        platformVersion: projectConfig.platformVersion,
        accountId,
      },
      { skipValidation, profile }
    );
    uiLogger.debug(util.inspect(intermediateRepresentation, false, null, true));
    return intermediateRepresentation;
  } catch (e) {
    if (isTranslationError(e)) {
      throw new ProjectValidationError(
        e.toString(includeTranslationErrorMessage),
        { cause: e }
      );
    }
    throw e;
  }
}
