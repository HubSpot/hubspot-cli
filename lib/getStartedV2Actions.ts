import fs from 'fs-extra';
import path from 'path';

import { fetchPublicAppsForPortal } from '@hubspot/local-dev-lib/api/appsDev';
import { fetchAppInstallationData } from '@hubspot/local-dev-lib/api/localDevAuth';
import { fetchProject } from '@hubspot/local-dev-lib/api/projects';
import { getConfigAccountEnvironment } from '@hubspot/local-dev-lib/config';
import { cloneGithubRepo } from '@hubspot/local-dev-lib/github';
import { getCwd } from '@hubspot/local-dev-lib/path';
import {
  getProjectMetadata,
  type ProjectMetadata,
} from '@hubspot/project-parsing-lib/projects';
import {
  translate,
  type IntermediateRepresentationNode,
} from '@hubspot/project-parsing-lib/translate';

import { Environment } from '@hubspot/local-dev-lib/types/Accounts';
import { commands, lib } from '../lang/en.js';
import { getStaticAuthAppInstallUrl } from '../lib/app/urls.js';
import {
  HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
  PROJECT_CONFIG_FILE,
} from '../lib/constants.js';
import {
  ProjectNestingError,
  ProjectConfigNotFoundError,
  ProjectValidationError,
  ProjectUploadError,
  ProjectBuildDeployError,
} from './errors/ProjectErrors.js';
import {
  getProjectConfig,
  validateProjectConfig,
  writeProjectConfig,
} from '../lib/projects/config.js';
import { isLegacyProject } from '@hubspot/project-parsing-lib/projects';
import { pollProjectBuildAndDeploy } from '../lib/projects/pollProjectBuildAndDeploy.js';
import { handleProjectUpload } from '../lib/projects/upload.js';
import { validateProjectDirectory } from '../lib/prompts/projectNameAndDestPrompt.js';
import { ProjectPollResult } from '../types/Projects.js';
import { trackCommandMetadataUsage } from './usageTracking.js';

export type CreateProjectResult = {
  projectName: string;
  projectDest: string;
};

export type AppConfig = {
  name?: string;
  uid?: string;
  distribution?: string;
  auth?: {
    type?: string;
    requiredScopes?: string[];
    optionalScopes?: string[];
  };
};

export type AppIRNode = IntermediateRepresentationNode & {
  config: AppConfig;
};

export async function createProjectAction({
  projectName,
  projectDest,
}: {
  projectName: string;
  projectDest: string;
}): Promise<CreateProjectResult> {
  if (!projectName || projectName.trim() === '') {
    throw new Error(lib.prompts.projectNameAndDestPrompt.errors.nameRequired);
  }

  const validationResult = validateProjectDirectory(projectDest);
  if (validationResult !== true) {
    throw new Error(
      typeof validationResult === 'string'
        ? validationResult
        : 'Invalid project directory'
    );
  }

  const projectDestAbsolute = path.resolve(getCwd(), projectDest);

  const {
    projectConfig: existingProjectConfig,
    projectDir: existingProjectDir,
  } = await getProjectConfig(projectDestAbsolute);

  if (
    existingProjectConfig &&
    existingProjectDir &&
    projectDestAbsolute.startsWith(existingProjectDir)
  ) {
    throw new ProjectNestingError(
      commands.project.create.errors.cannotNestProjects(existingProjectDir)
    );
  }

  try {
    await cloneGithubRepo(
      HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
      projectDestAbsolute,
      {
        sourceDir: '2026.03/private-app-get-started-template',
        hideLogs: true,
      }
    );

    const projectConfigPath = path.join(
      projectDestAbsolute,
      PROJECT_CONFIG_FILE
    );
    const parsedConfigFile = JSON.parse(
      fs.readFileSync(projectConfigPath, 'utf8')
    );
    writeProjectConfig(projectConfigPath, {
      ...parsedConfigFile,
      name: projectName,
    });

    return { projectName, projectDest: projectDestAbsolute };
  } catch (error) {
    throw new Error(commands.project.create.errors.failedToDownloadProject, {
      cause: error,
    });
  }
}

export type UploadAndDeployResult = {
  appId: number;
  projectId: number;
  installUrl: string;
  projectDir: string;
  app: AppIRNode;
  projectName: string;
  projectMetadata: ProjectMetadata;
};

type FetchAppResult = {
  appId: number;
  installUrl: string;
};

type ProjectMetadataResult = {
  projectMetadata: ProjectMetadata;
  app: AppIRNode;
};

async function fetchAppAfterDeploy(
  accountId: number,
  env: Environment
): Promise<FetchAppResult> {
  const {
    data: { results },
  } = await fetchPublicAppsForPortal(accountId);

  const lastCreatedApp = results.sort((a, b) => b.createdAt - a.createdAt)[0];

  if (!lastCreatedApp) {
    throw new Error(commands.getStarted.errors.noAppsFound);
  }

  const installUrl = getStaticAuthAppInstallUrl({
    targetAccountId: accountId,
    env,
    appId: lastCreatedApp.id,
  });

  return {
    appId: lastCreatedApp.id,
    installUrl,
  };
}

async function buildProjectMetadata(
  projectDir: string,
  projectConfig: { srcDir: string; platformVersion: string },
  accountId: number
): Promise<ProjectMetadataResult> {
  const srcDir = path.join(projectDir, projectConfig.srcDir);
  const projectMetadata = await getProjectMetadata(srcDir);

  const intermediateRepresentation = await translate(
    {
      projectSourceDir: srcDir,
      platformVersion: projectConfig.platformVersion,
      accountId,
    },
    { skipValidation: false }
  );

  const apps: AppIRNode[] = Object.values(
    intermediateRepresentation.intermediateNodesIndexedByUid
  ).filter(node => node.componentType === 'APPLICATION') as AppIRNode[];

  if (apps.length === 0) {
    throw new Error(commands.getStarted.errors.noAppsFound);
  }

  return {
    projectMetadata,
    app: apps[0],
  };
}

export async function uploadAndDeployAction({
  accountId,
  projectDest,
}: {
  accountId: number;
  projectDest: string;
}): Promise<UploadAndDeployResult> {
  const { projectConfig, projectDir } = await getProjectConfig(projectDest);

  if (!projectConfig || !projectDir) {
    throw new ProjectConfigNotFoundError(
      commands.getStarted.errors.configFileNotFound
    );
  }

  try {
    validateProjectConfig(projectConfig, projectDir);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ProjectValidationError(message);
  }

  const env = getConfigAccountEnvironment(accountId);

  try {
    const { result, uploadError } =
      await handleProjectUpload<ProjectPollResult>({
        accountId,
        projectConfig,
        projectDir,
        callbackFunc: pollProjectBuildAndDeploy,
        uploadMessage: commands.getStarted.logs.initialUploadMessage,
        forceCreate: true,
        isUploadCommand: false,
        sendIR: !isLegacyProject(projectConfig.platformVersion),
        skipValidation: false,
      });

    if (uploadError) {
      throw new ProjectUploadError(
        commands.getStarted.errors.uploadActionFailed,
        uploadError
      );
    }

    if (!result || !result.succeeded) {
      throw new ProjectBuildDeployError(
        commands.getStarted.errors.buildOrDeployFailed
      );
    }

    const { data: projectData } = await fetchProject(
      accountId,
      projectConfig.name
    );
    const projectId = projectData.id;

    const { appId, installUrl } = await fetchAppAfterDeploy(accountId, env);

    const { projectMetadata, app } = await buildProjectMetadata(
      projectDir,
      projectConfig,
      accountId
    );

    return {
      appId,
      projectId,
      installUrl,
      projectDir,
      app,
      projectName: projectConfig.name,
      projectMetadata,
    };
  } catch (error) {
    if (
      error instanceof ProjectUploadError ||
      error instanceof ProjectBuildDeployError
    ) {
      throw error;
    }
    throw new Error(commands.getStarted.errors.failedToUploadAndDeploy, {
      cause: error,
    });
  }
}

export function trackGetStartedUsage(
  params: Record<string, unknown>,
  accountId: number
) {
  return trackCommandMetadataUsage('get-started', params, accountId);
}

export type PollAppInstallationOptions = {
  accountId: number;
  projectId: number;
  appUid: string;
  requiredScopes?: string[];
  optionalScopes?: string[];
  timeoutMs?: number;
  intervalMs?: number;
  onTimeout?: () => void;
};

export async function pollAppInstallation({
  accountId,
  projectId,
  appUid,
  requiredScopes = [],
  optionalScopes = [],
  timeoutMs = 2 * 60 * 1000, // 2 minutes
  intervalMs = 2000, // 2 seconds
  onTimeout,
}: PollAppInstallationOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 5;
    let pollInterval: NodeJS.Timeout | null = null;
    let pollTimeout: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (pollInterval) {
        clearTimeout(pollInterval);
        pollInterval = null;
      }
      if (pollTimeout) {
        clearTimeout(pollTimeout);
        pollTimeout = null;
      }
    };

    pollTimeout = setTimeout(() => {
      cleanup();
      if (onTimeout) {
        onTimeout();
      }
      resolve(); // Resolve instead of reject to allow continuing with timeout state
    }, timeoutMs);

    const poll = async () => {
      try {
        const { data } = await fetchAppInstallationData(
          accountId,
          projectId,
          appUid,
          requiredScopes,
          optionalScopes
        );

        // Reset error counter on successful fetch
        consecutiveErrors = 0;

        if (data.isInstalledWithScopeGroups) {
          cleanup();
          resolve();
        } else if (pollInterval) {
          pollInterval = setTimeout(poll, intervalMs);
        }
      } catch (error) {
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          cleanup();
          reject(
            new Error(
              `Failed to check app installation status after ${MAX_CONSECUTIVE_ERRORS} consecutive errors`,
              { cause: error }
            )
          );
        } else if (pollInterval !== null) {
          pollInterval = setTimeout(poll, intervalMs);
        }
      }
    };

    pollInterval = setTimeout(poll, 0);
  });
}
