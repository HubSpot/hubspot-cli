import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';
import tmp, { FileResult } from 'tmp';
import findup from 'findup-sync';
import { logger } from '@hubspot/local-dev-lib/logger';
import { fetchFileFromRepository } from '@hubspot/local-dev-lib/github';
import {
  createProject,
  fetchProject,
  uploadProject,
} from '@hubspot/local-dev-lib/api/projects';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import { shouldIgnoreFile } from '@hubspot/local-dev-lib/ignoreRules';
import { getCwd, getAbsoluteFilePath } from '@hubspot/local-dev-lib/path';
import { downloadGithubRepoContents } from '@hubspot/local-dev-lib/github';
import { RepoPath } from '@hubspot/local-dev-lib/types/Github';
import { Project } from '@hubspot/local-dev-lib/types/Project';
import { HubSpotPromise } from '@hubspot/local-dev-lib/types/Http';

import {
  FEEDBACK_INTERVAL,
  POLLING_DELAY,
  PROJECT_CONFIG_FILE,
  HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
  PROJECT_COMPONENT_TYPES,
} from '../constants';
import { promptUser } from '../prompts/promptUtils';
import { EXIT_CODES } from '../enums/exitCodes';
import { uiLine, uiAccountDescription, uiCommandReference } from '../ui';
import { i18n } from '../lang';
import SpinniesManager from '../ui/SpinniesManager';
import { logError, ApiErrorContext } from '../errorHandlers/index';
import {
  ProjectTemplate,
  ProjectConfig,
  ProjectAddComponentData,
  ProjectTemplateRepoConfig,
  ComponentTemplate,
} from '../../types/projects';

const i18nKey = 'lib.projects';

export function writeProjectConfig(
  configPath: string,
  config: ProjectConfig
): boolean {
  try {
    fs.ensureFileSync(configPath);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    logger.debug(`Wrote project config at ${configPath}`);
  } catch (e) {
    logger.debug(e);
    return false;
  }
  return true;
}

export function getIsInProject(dir?: string): boolean {
  const configPath = getProjectConfigPath(dir);
  return !!configPath;
}

function getProjectConfigPath(dir?: string): string | null {
  const projectDir = dir ? getAbsoluteFilePath(dir) : getCwd();

  const configPath = findup(PROJECT_CONFIG_FILE, {
    cwd: projectDir,
    nocase: true,
  });

  return configPath;
}

export async function getProjectConfig(dir?: string): Promise<{
  projectDir: string | null;
  projectConfig: ProjectConfig | null;
}> {
  const configPath = await getProjectConfigPath(dir);
  if (!configPath) {
    return { projectConfig: null, projectDir: null };
  }

  try {
    const config = fs.readFileSync(configPath);
    const projectConfig: ProjectConfig = JSON.parse(config.toString());
    return {
      projectDir: path.dirname(configPath),
      projectConfig,
    };
  } catch (e) {
    logger.error('Could not read from project config');
    return { projectConfig: null, projectDir: null };
  }
}

export async function createProjectConfig(
  projectPath: string,
  projectName: string,
  template: ProjectTemplate,
  templateSource: RepoPath,
  githubRef: string
): Promise<boolean> {
  const { projectConfig, projectDir } = await getProjectConfig(projectPath);

  if (projectConfig) {
    logger.warn(
      projectPath === projectDir
        ? 'A project already exists in that location.'
        : `Found an existing project definition in ${projectDir}.`
    );

    const { shouldContinue } = await promptUser<{ shouldContinue: boolean }>([
      {
        name: 'shouldContinue',
        message: () => {
          return projectPath === projectDir
            ? 'Do you want to overwrite the existing project definition with a new one?'
            : `Continue creating a new project in ${projectPath}?`;
        },
        type: 'confirm',
        default: false,
      },
    ]);

    if (!shouldContinue) {
      return false;
    }
  }

  const projectConfigPath = path.join(projectPath, PROJECT_CONFIG_FILE);

  logger.log(
    `Creating project config in ${
      projectPath ? projectPath : 'the current folder'
    }`
  );

  const hasCustomTemplateSource = Boolean(templateSource);

  await downloadGithubRepoContents(
    templateSource || HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
    template.path,
    projectPath,
    hasCustomTemplateSource ? undefined : githubRef
  );
  const _config: ProjectConfig = JSON.parse(
    fs.readFileSync(projectConfigPath).toString()
  );
  writeProjectConfig(projectConfigPath, {
    ..._config,
    name: projectName,
  });

  if (template.name === 'no-template') {
    fs.ensureDirSync(path.join(projectPath, 'src'));
  }

  return true;
}

export function validateProjectConfig(
  projectConfig: ProjectConfig,
  projectDir: string
): void {
  if (!projectConfig) {
    logger.error(
      i18n(`${i18nKey}.validateProjectConfig.configNotFound`, {
        createCommand: uiCommandReference('hs project create'),
      })
    );
    return process.exit(EXIT_CODES.ERROR);
  }

  if (!projectConfig.name || !projectConfig.srcDir) {
    logger.error(i18n(`${i18nKey}.validateProjectConfig.configMissingFields`));
    return process.exit(EXIT_CODES.ERROR);
  }

  const resolvedPath = path.resolve(projectDir, projectConfig.srcDir);
  if (!resolvedPath.startsWith(projectDir)) {
    const projectConfigFile = path.relative(
      '.',
      path.join(projectDir, PROJECT_CONFIG_FILE)
    );
    logger.error(
      i18n(`${i18nKey}.validateProjectConfig.srcOutsideProjectDir`, {
        srcDir: projectConfig.srcDir,
        projectConfig: projectConfigFile,
      })
    );
    return process.exit(EXIT_CODES.ERROR);
  }

  if (!fs.existsSync(resolvedPath)) {
    logger.error(
      i18n(`${i18nKey}.validateProjectConfig.srcDirNotFound`, {
        srcDir: projectConfig.srcDir,
        projectDir: projectDir,
      })
    );

    return process.exit(EXIT_CODES.ERROR);
  }
}

async function pollFetchProject(
  accountId: number,
  projectName: string
): HubSpotPromise<Project> {
  // Temporary solution for gating slowness. Retry on 403 statusCode
  return new Promise((resolve, reject) => {
    let pollCount = 0;
    SpinniesManager.init();
    SpinniesManager.add('pollFetchProject', {
      text: i18n(`${i18nKey}.pollFetchProject.checkingProject`, {
        accountIdentifier: uiAccountDescription(accountId),
      }),
    });
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetchProject(accountId, projectName);
        if (response && response.data) {
          SpinniesManager.remove('pollFetchProject');
          clearInterval(pollInterval);
          resolve(response);
        }
      } catch (err) {
        if (
          isSpecifiedError(err, {
            statusCode: 403,
            category: 'GATED',
            subCategory: 'BuildPipelineErrorType.PORTAL_GATED',
          }) &&
          pollCount < 15
        ) {
          pollCount += 1;
        } else {
          SpinniesManager.remove('pollFetchProject');
          clearInterval(pollInterval);
          reject(err);
        }
      }
    }, POLLING_DELAY);
  });
}

export async function ensureProjectExists(
  accountId: number,
  projectName: string,
  {
    forceCreate = false,
    allowCreate = true,
    noLogs = false,
    withPolling = false,
    uploadCommand = false,
  } = {}
): Promise<{
  projectExists: boolean;
  project?: Project;
}> {
  const accountIdentifier = uiAccountDescription(accountId);
  try {
    const { data: project } = withPolling
      ? await pollFetchProject(accountId, projectName)
      : await fetchProject(accountId, projectName);
    return { projectExists: !!project, project };
  } catch (err) {
    if (isSpecifiedError(err, { statusCode: 404 })) {
      let shouldCreateProject = forceCreate;
      if (allowCreate && !shouldCreateProject) {
        const promptKey = uploadCommand ? 'createPromptUpload' : 'createPrompt';
        const promptResult = await promptUser<{ shouldCreateProject: boolean }>(
          [
            {
              name: 'shouldCreateProject',
              message: i18n(`${i18nKey}.ensureProjectExists.${promptKey}`, {
                projectName,
                accountIdentifier,
              }),
              type: 'confirm',
            },
          ]
        );
        shouldCreateProject = promptResult.shouldCreateProject;
      }

      if (shouldCreateProject) {
        try {
          const { data: project } = await createProject(accountId, projectName);
          logger.success(
            i18n(`${i18nKey}.ensureProjectExists.createSuccess`, {
              projectName,
              accountIdentifier,
            })
          );
          return { projectExists: true, project };
        } catch (err) {
          logError(err, new ApiErrorContext({ accountId }));
          return { projectExists: false };
        }
      } else {
        if (!noLogs) {
          logger.log(
            i18n(`${i18nKey}.ensureProjectExists.notFound`, {
              projectName,
              accountIdentifier,
            })
          );
        }
        return { projectExists: false };
      }
    }
    if (
      isSpecifiedError(err, {
        statusCode: 401,
      })
    ) {
      logger.error(err.message);
      process.exit(EXIT_CODES.ERROR);
    }
    logError(err, new ApiErrorContext({ accountId }));
    process.exit(EXIT_CODES.ERROR);
  }
}

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
        console.log('callbackfunc');
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

export function logFeedbackMessage(buildId: number): void {
  if (buildId > 0 && buildId % FEEDBACK_INTERVAL === 0) {
    uiLine();
    logger.log(i18n(`${i18nKey}.logFeedbackMessage.feedbackHeader`));
    uiLine();
    logger.log(i18n(`${i18nKey}.logFeedbackMessage.feedbackMessage`));
  }
}

export async function createProjectComponent(
  component: ProjectAddComponentData,
  name: string,
  projectComponentsVersion: string
): Promise<void> {
  const i18nKey = 'commands.project.subcommands.add';
  const componentName = name;

  const configInfo = await getProjectConfig();

  if (!configInfo.projectDir || !configInfo.projectConfig) {
    logger.error(i18n(`${i18nKey}.error.locationInProject`));
    process.exit(EXIT_CODES.ERROR);
  }

  const componentPath = path.join(
    configInfo.projectDir,
    configInfo.projectConfig.srcDir,
    component.insertPath,
    componentName
  );

  await downloadGithubRepoContents(
    HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
    component.path,
    componentPath,
    projectComponentsVersion
  );
}

export async function getProjectComponentsByVersion(
  projectComponentsVersion: string
): Promise<ComponentTemplate[]> {
  const config = await fetchFileFromRepository<ProjectTemplateRepoConfig>(
    HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
    'config.json',
    projectComponentsVersion
  );

  return config[PROJECT_COMPONENT_TYPES.COMPONENTS] || [];
}
