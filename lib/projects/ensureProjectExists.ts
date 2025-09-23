import {
  createProject,
  fetchProject,
} from '@hubspot/local-dev-lib/api/projects';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import { Project } from '@hubspot/local-dev-lib/types/Project';
import { HubSpotPromise } from '@hubspot/local-dev-lib/types/Http';

import { DEFAULT_POLLING_DELAY } from '../constants.js';
import { promptUser } from '../prompts/promptUtils.js';
import { EXIT_CODES } from '../enums/exitCodes.js';
import { uiAccountDescription } from '../ui/index.js';
import SpinniesManager from '../ui/SpinniesManager.js';
import { logError, ApiErrorContext } from '../errorHandlers/index.js';
import { lib } from '../../lang/en.js';
import { uiLogger } from '../ui/logger.js';

async function pollFetchProject(
  accountId: number,
  projectName: string
): HubSpotPromise<Project> {
  // Temporary solution for gating slowness. Retry on 403 statusCode
  return new Promise((resolve, reject) => {
    let pollCount = 0;
    SpinniesManager.init();
    SpinniesManager.add('pollFetchProject', {
      text: lib.projects.pollFetchProject.checkingProject(
        uiAccountDescription(accountId)
      ),
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
        const promptLangFunction = uploadCommand
          ? lib.projects.ensureProjectExists.createPromptUpload
          : lib.projects.ensureProjectExists.createPrompt;
        const promptResult = await promptUser<{ shouldCreateProject: boolean }>(
          [
            {
              name: 'shouldCreateProject',
              message: promptLangFunction(projectName, accountIdentifier),
              type: 'confirm',
            },
          ]
        );
        shouldCreateProject = promptResult.shouldCreateProject;
      }

      if (shouldCreateProject) {
        try {
          const { data: project } = await createProject(accountId, projectName);
          uiLogger.success(
            lib.projects.ensureProjectExists.createSuccess(
              projectName,
              accountIdentifier
            )
          );
          return { projectExists: true, project };
        } catch (err) {
          logError(err, new ApiErrorContext({ accountId }));
          return { projectExists: false };
        }
      } else {
        if (!noLogs) {
          uiLogger.log(
            lib.projects.ensureProjectExists.notFound(
              projectName,
              accountIdentifier
            )
          );
        }
        return { projectExists: false };
      }
    }
    logError(err, new ApiErrorContext({ accountId }));
    process.exit(EXIT_CODES.ERROR);
  }
}
