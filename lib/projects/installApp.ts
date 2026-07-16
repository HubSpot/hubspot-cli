import path from 'path';
import { fetchAppInstallationData } from '@hubspot/local-dev-lib/api/localDevAuth';
import {
  fetchAppMetadataBySourceId,
  fetchPublicAppMetadata,
  installStaticAuthAppOnCurrentAccount,
  installStaticAuthAppOnTestAccount,
} from '@hubspot/local-dev-lib/api/appsDev';
import { fetchProject } from '@hubspot/local-dev-lib/api/projects';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import {
  getAllConfigAccounts,
  getConfigAccountIfExists,
} from '@hubspot/local-dev-lib/config';
import type {
  Environment,
  HubSpotConfigAccount,
} from '@hubspot/local-dev-lib/types/Accounts';
import { translateForLocalDev } from '@hubspot/project-parsing-lib/translate';

import { commands } from '../../lang/en.js';
import { warnAboutSkippedHsMetaFiles } from './ui.js';
import type {
  AppInstallationState,
  AppIRNode,
} from '../../types/ProjectComponents.js';
import type { ProjectConfig, ProjectPollResult } from '../../types/Projects.js';
import { isAppDeveloperAccount } from '../accountTypes.js';
import {
  ApiErrorContext,
  debugError,
  logError,
} from '../errorHandlers/index.js';
import { confirmPrompt, listPrompt } from '../prompts/promptUtils.js';
import { projectProfilePrompt } from '../prompts/projectProfilePrompt.js';
import { loadProfile } from './projectProfiles.js';
import { handleProjectUpload } from './upload.js';
import { pollProjectBuildAndDeploy } from './pollProjectBuildAndDeploy.js';
import {
  getAppNodeFromProjectNodes,
  canUseStaticAuthTestAccountInstall,
  isPrivateApp,
  isStaticAuthApp,
  type ScopeGroup,
} from '../app/install.js';
import { uiLogger } from '../ui/logger.js';
import { uiAccountDescription } from '../ui/index.js';
import { getStaticAuthAppInstallUrl } from '../app/urls.js';

export type AppInstallationData = {
  appId?: number;
  isInstalledWithScopeGroups: boolean;
  previouslyAuthorizedScopeGroups: ScopeGroup[];
};

export type AppMetadata = {
  appId: number;
  scopeGroupIds: number[];
  ownerPortalId: number;
};

type ConfirmInstallAppOptions = {
  appName: string;
  targetAccountId: number;
  force: boolean;
  needsReinstall: boolean;
};

type InstallStaticAuthAppOptions = {
  appId: number;
  appNode: AppIRNode;
  appName: string;
  targetAccountId: number;
  targetAccountConfig?: HubSpotConfigAccount;
  projectId: number;
  projectName: string;
  scopeGroupIds: number[];
  ownerPortalId: number;
  installationState: AppInstallationState;
  formatOutputAsJson: boolean;
};

type UploadAndDeployOptions = {
  accountId: number;
  projectConfig: ProjectConfig;
  projectDir: string;
  profile: string | undefined;
  force: boolean;
  formatOutputAsJson: boolean;
};

export async function resolveProjectAccountId(
  derivedAccountId: number,
  projectConfig: ProjectConfig,
  projectDir: string,
  profileOption: string | undefined,
  useEnvOption: boolean
): Promise<{ accountId: number; profileName?: string } | null> {
  try {
    const profileName = await projectProfilePrompt(
      projectDir,
      projectConfig,
      profileOption,
      useEnvOption
    );

    if (profileName) {
      const profile = loadProfile(projectConfig, projectDir, profileName);
      uiLogger.log(
        commands.project.installApp.profileMessage(
          profileName,
          profile.accountId
        )
      );
      uiLogger.log('');
      return { accountId: profile.accountId, profileName };
    }

    return { accountId: derivedAccountId };
  } catch (error) {
    logError(error);
    return null;
  }
}

export async function loadInstallableAppNode(
  projectConfig: ProjectConfig,
  projectDir: string,
  accountId: number,
  force = false
): Promise<AppIRNode | null> {
  let appNode: AppIRNode | null;
  try {
    const { intermediateRepresentation, skippedHsMetaFiles } =
      await translateForLocalDev(
        {
          projectSourceDir: path.join(projectDir, projectConfig.srcDir),
          platformVersion: projectConfig.platformVersion,
          accountId,
        },
        { skipValidation: true }
      );
    const shouldContinue = await warnAboutSkippedHsMetaFiles(
      skippedHsMetaFiles,
      force,
      false
    );
    if (!shouldContinue) {
      return null;
    }
    appNode = getAppNodeFromProjectNodes(
      intermediateRepresentation.intermediateNodesIndexedByUid
    );
  } catch (error) {
    debugError(error);
    uiLogger.error(commands.project.installApp.errors.failedToParseProject);
    return null;
  }

  if (!appNode) {
    uiLogger.error(commands.project.installApp.errors.noAppInProject);
    return null;
  }

  if (!isStaticAuthApp(appNode)) {
    uiLogger.error(
      commands.project.installApp.errors.unsupportedAuthType(
        appNode.config.auth.type
      )
    );
    return null;
  }

  if (!isPrivateApp(appNode)) {
    uiLogger.error(
      commands.project.installApp.errors.unsupportedDistribution(
        appNode.config.distribution || 'unknown'
      )
    );
    return null;
  }

  return appNode;
}

// App developer accounts can't host app installs.
export async function resolveValidInstallAccount(
  targetAccountId: number,
  force: boolean,
  formatOutputAsJson: boolean
): Promise<number | null> {
  const accountConfig = getConfigAccountIfExists(targetAccountId);
  if (!accountConfig || !isAppDeveloperAccount(accountConfig)) {
    return targetAccountId;
  }

  const validAccounts = getAllConfigAccounts().filter(
    account => !isAppDeveloperAccount(account)
  );

  if (force || formatOutputAsJson || validAccounts.length === 0) {
    uiLogger.error(
      commands.project.installApp.errors.invalidAppDeveloperAccount(
        targetAccountId
      )
    );
    return null;
  }

  uiLogger.log(
    commands.project.installApp.appDeveloperAccountNotice(targetAccountId)
  );
  return listPrompt<number>(
    commands.project.installApp.selectInstallAccountPrompt,
    {
      choices: validAccounts.map(account => ({
        name: uiAccountDescription(account.accountId, false),
        value: account.accountId,
      })),
    }
  );
}

async function offerUploadAndDeploy(
  options: UploadAndDeployOptions
): Promise<boolean> {
  const { accountId, projectConfig, projectDir, profile, force } = options;

  if (!force) {
    if (options.formatOutputAsJson) {
      return false;
    }
    const shouldUpload = await confirmPrompt(
      commands.project.installApp.uploadAndDeployPrompt(accountId)
    );
    if (!shouldUpload) {
      return false;
    }
  }

  try {
    const { result, uploadError } =
      await handleProjectUpload<ProjectPollResult>({
        accountId,
        projectConfig,
        projectDir,
        callbackFunc: pollProjectBuildAndDeploy,
        isUploadCommand: true,
        sendIR: true,
        forceCreate: true,
        profile,
      });
    if (uploadError) {
      logError(
        uploadError,
        new ApiErrorContext({ accountId, projectName: projectConfig.name })
      );
      return false;
    }
    return Boolean(result && result.succeeded);
  } catch (error) {
    logError(
      error,
      new ApiErrorContext({ accountId, projectName: projectConfig.name })
    );
    return false;
  }
}

export async function resolveProjectId(
  options: UploadAndDeployOptions
): Promise<number | null> {
  const { accountId, projectConfig } = options;
  try {
    const response = await fetchProject(accountId, projectConfig.name);
    return response.data.id;
  } catch (error) {
    if (!isHubSpotHttpError(error) || error.status !== 404) {
      logError(
        error,
        new ApiErrorContext({ accountId, projectName: projectConfig.name })
      );
      return null;
    }
    const uploaded = await offerUploadAndDeploy(options);
    if (!uploaded) {
      uiLogger.error(
        commands.project.installApp.errors.projectNotFound(
          accountId,
          projectConfig.name
        )
      );
      return null;
    }
    try {
      const response = await fetchProject(accountId, projectConfig.name);
      return response.data.id;
    } catch (retryError) {
      logError(
        retryError,
        new ApiErrorContext({ accountId, projectName: projectConfig.name })
      );
      return null;
    }
  }
}

export async function resolveAppMetadata(
  options: UploadAndDeployOptions & {
    appId: number | undefined;
    projectId: number;
    appUid: string;
    appName: string;
  }
): Promise<AppMetadata | null> {
  const { appId, projectId, appUid, appName, accountId, projectConfig } =
    options;

  const fetchMetadata = (forceSourceIdLookup = false) =>
    appId && !forceSourceIdLookup
      ? fetchPublicAppMetadata(appId, accountId)
      : fetchAppMetadataBySourceId(projectId, appUid, accountId);

  try {
    const { data } = await fetchMetadata();
    return {
      appId: appId ?? data.id,
      scopeGroupIds: data.scopeGroupIds,
      ownerPortalId: data.portalId,
    };
  } catch (error) {
    if (!isHubSpotHttpError(error) || error.status !== 404) {
      logError(
        error,
        new ApiErrorContext({ accountId, projectName: projectConfig.name })
      );
      return null;
    }
    const uploaded = await offerUploadAndDeploy(options);
    if (!uploaded) {
      uiLogger.error(
        commands.project.installApp.errors.appNotDeployed(appName, accountId)
      );
      return null;
    }
    try {
      const { data } = await fetchMetadata(true);
      return {
        appId: data.id,
        scopeGroupIds: data.scopeGroupIds,
        ownerPortalId: data.portalId,
      };
    } catch (retryError) {
      logError(
        retryError,
        new ApiErrorContext({ accountId, projectName: projectConfig.name })
      );
      return null;
    }
  }
}

export async function fetchProjectAppInstallationData(
  targetAccountId: number,
  projectId: number,
  appNode: AppIRNode,
  projectConfig: ProjectConfig
): Promise<AppInstallationData | null> {
  try {
    const response = await fetchAppInstallationData(
      targetAccountId,
      projectId,
      appNode.uid,
      appNode.config.auth.requiredScopes,
      appNode.config.auth.optionalScopes
    );
    return {
      appId: response.data.appId,
      isInstalledWithScopeGroups: response.data.isInstalledWithScopeGroups,
      previouslyAuthorizedScopeGroups:
        response.data.previouslyAuthorizedScopeGroups,
    };
  } catch (error) {
    if (isHubSpotHttpError(error) && error.status === 404) {
      return {
        isInstalledWithScopeGroups: false,
        previouslyAuthorizedScopeGroups: [],
      };
    }

    logError(
      error,
      new ApiErrorContext({
        accountId: targetAccountId,
        projectName: projectConfig.name,
      })
    );
    return null;
  }
}

export async function confirmInstallAppAction({
  appName,
  targetAccountId,
  force,
  needsReinstall,
}: ConfirmInstallAppOptions): Promise<boolean> {
  if (force) {
    return true;
  }

  if (needsReinstall) {
    uiLogger.log(
      commands.project.installApp.outdatedScopes(appName, targetAccountId)
    );

    return confirmPrompt(commands.project.installApp.reinstallPrompt);
  }

  return confirmPrompt(
    commands.project.installApp.installPrompt(appName, targetAccountId)
  );
}

export async function installStaticAuthAppForAccount({
  appId,
  appNode,
  appName,
  targetAccountId,
  targetAccountConfig,
  projectId,
  projectName,
  scopeGroupIds,
  ownerPortalId,
  installationState,
  formatOutputAsJson,
}: InstallStaticAuthAppOptions): Promise<boolean> {
  const installingIntoOwnerAccount = ownerPortalId === targetAccountId;
  const useTestAccountInstall =
    !installingIntoOwnerAccount &&
    canUseStaticAuthTestAccountInstall({
      accountConfig: targetAccountConfig,
      appNode,
    });

  if (!installingIntoOwnerAccount && !useTestAccountInstall) {
    const installUrl = getStaticAuthAppInstallUrl({
      targetAccountId,
      env: (targetAccountConfig?.env || 'prod') as Environment,
      appId,
    });

    if (formatOutputAsJson) {
      uiLogger.json({
        appId,
        appUid: appNode.uid,
        accountId: targetAccountId,
        projectId,
        installationState,
        installed: false,
        reinstalled: false,
        installUrl,
        error:
          commands.project.installApp.jsonErrors.automaticInstallUnavailable,
      });
    } else {
      uiLogger.error(
        commands.project.installApp.errors.automaticInstallUnavailable(
          appName,
          targetAccountId
        )
      );
      uiLogger.log(commands.project.installApp.installFromBrowser(installUrl));
    }
    return false;
  }

  try {
    if (useTestAccountInstall) {
      await installStaticAuthAppOnTestAccount(
        appId,
        targetAccountId,
        scopeGroupIds
      );
    } else {
      await installStaticAuthAppOnCurrentAccount(
        appId,
        targetAccountId,
        scopeGroupIds
      );
    }
    return true;
  } catch (error) {
    if (formatOutputAsJson) {
      uiLogger.json({
        appId,
        appUid: appNode.uid,
        accountId: targetAccountId,
        projectId,
        installationState,
        installed: false,
        reinstalled: false,
        error: isHubSpotHttpError(error)
          ? error.message
          : commands.project.installApp.jsonErrors.installFailed(
              appName,
              targetAccountId
            ),
      });
    } else {
      uiLogger.error(
        commands.project.installApp.errors.installFailed(
          appName,
          targetAccountId
        )
      );
      logError(
        error,
        new ApiErrorContext({
          accountId: targetAccountId,
          projectName,
        })
      );
    }
    return false;
  }
}
