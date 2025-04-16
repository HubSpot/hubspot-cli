import fs from 'fs-extra';
import path from 'path';
import findup from 'findup-sync';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  createProject,
  fetchProject,
} from '@hubspot/local-dev-lib/api/projects';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import { getCwd, getAbsoluteFilePath } from '@hubspot/local-dev-lib/path';
import { Project } from '@hubspot/local-dev-lib/types/Project';
import { HubSpotPromise } from '@hubspot/local-dev-lib/types/Http';

import {
  FEEDBACK_INTERVAL,
  DEFAULT_POLLING_DELAY,
  PROJECT_CONFIG_FILE,
} from '../constants';
import { promptUser } from '../prompts/promptUtils';
import { EXIT_CODES } from '../enums/exitCodes';
import { uiLine, uiAccountDescription, uiCommandReference } from '../ui';
import { i18n } from '../lang';
import SpinniesManager from '../ui/SpinniesManager';
import { ProjectConfig } from '../../types/Projects';
import { logError, ApiErrorContext } from '../errorHandlers/index';

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

export interface LoadedProjectConfig {
  projectDir: string | null;
  projectConfig: ProjectConfig | null;
}

export async function getProjectConfig(
  dir?: string
): Promise<LoadedProjectConfig> {
  const configPath = getProjectConfigPath(dir);
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

export function validateProjectConfig(
  projectConfig: ProjectConfig | null,
  projectDir: string | null
): asserts projectConfig is ProjectConfig {
  if (!projectConfig || !projectDir) {
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
    }, DEFAULT_POLLING_DELAY);
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
    logError(err, new ApiErrorContext({ accountId }));
    process.exit(EXIT_CODES.ERROR);
  }
}

export function logFeedbackMessage(buildId: number): void {
  if (buildId > 0 && buildId % FEEDBACK_INTERVAL === 0) {
    uiLine();
    logger.log(i18n(`${i18nKey}.logFeedbackMessage.feedbackHeader`));
    uiLine();
    logger.log(i18n(`${i18nKey}.logFeedbackMessage.feedbackMessage`));
  }
}
