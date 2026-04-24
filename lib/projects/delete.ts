import {
  fetchProjects,
  fetchProject,
  stageProjectForDeletion,
  getDeployStatus,
  deleteProject,
} from '@hubspot/local-dev-lib/api/projects';
import { fetchPublicAppsForPortal } from '@hubspot/local-dev-lib/api/appsDev';
import { debugError, getErrorMessage } from '../errorHandlers/index.js';
import { uiLogger } from '../ui/logger.js';
import SpinniesManager from '../ui/SpinniesManager.js';
import { commands } from '../../lang/en.js';
import { confirmPrompt, listPrompt } from '../prompts/promptUtils.js';
import {
  poll,
  DEFAULT_POLLING_STATES,
  DEFAULT_POLLING_STATUS_LOOKUP,
} from '../polling.js';
import { PromptExitError } from '../errors/PromptExitError.js';
import { EXIT_CODES } from '../enums/exitCodes.js';
import { AUTO_GENERATED_COMPONENT_TYPES } from '@hubspot/project-parsing-lib/constants';
import { mapToUserFacingType } from '@hubspot/project-parsing-lib/transform';
import { isLegacyProject } from '@hubspot/project-parsing-lib/projects';
import {
  COMPONENT_TYPES,
  SUBCOMPONENT_TYPES,
} from '@hubspot/local-dev-lib/enums/build';
import { ProjectDeletionResponse } from '@hubspot/local-dev-lib/types/Deploy';

export const DELETION_POLL_TIMEOUT_MS = 5 * 60 * 1000;
export const DELETION_DEPLOY_SUCCESS_STATES = [
  DEFAULT_POLLING_STATES.SUCCESS,
  'FINISHED',
];
export const DELETION_DEPLOY_ERROR_STATES =
  DEFAULT_POLLING_STATUS_LOOKUP.errorStates;

const LEGACY_COMPONENTS_TO_FILTER: string[] = [
  SUBCOMPONENT_TYPES.SERVERLESS_PKG,
  SUBCOMPONENT_TYPES.REACT_EXTENSION,
  SUBCOMPONENT_TYPES.PACKAGE_LOCK_FILE,
  COMPONENT_TYPES.PRIVATE_APP,
  COMPONENT_TYPES.PUBLIC_APP,
];

const legacyComponentFriendlyNames: Record<string, string> = {
  [SUBCOMPONENT_TYPES.APP_ID]: 'Private App',
  [SUBCOMPONENT_TYPES.PUBLIC_APP_ID]: 'Public App',
  [SUBCOMPONENT_TYPES.CRM_CARD_V2]: 'Card',
  [SUBCOMPONENT_TYPES.CARD_V2]: 'Card',
  [SUBCOMPONENT_TYPES.SERVERLESS_FUNCTION]: 'Serverless Function',
  [SUBCOMPONENT_TYPES.APP_FUNCTION]: 'App Function',
  [SUBCOMPONENT_TYPES.AUTOMATION_ACTION]: 'Automation Action',
  [SUBCOMPONENT_TYPES.WEBHOOKS]: 'Webhooks',
  [COMPONENT_TYPES.THEME]: 'Theme',
  [COMPONENT_TYPES.REACT_THEME]: 'React Theme',
};

function mapLegacyComponentToUserFriendlyName(type: string): string {
  return legacyComponentFriendlyNames[type] || 'unknown';
}

export async function resolveProjectName(
  accountId: number,
  projectArg: string | undefined
): Promise<string> {
  const { data } = await fetchProjects(accountId);
  const projects = data.results;

  if (projectArg) {
    if (!projects.some(p => p.name === projectArg)) {
      throw new Error(
        commands.project.delete.errors.projectNotFound(projectArg, accountId)
      );
    }
    return projectArg;
  }

  if (projects.length === 0) {
    throw new Error(commands.project.delete.errors.noProjectsFound(accountId));
  }

  const selected = await listPrompt(
    commands.project.delete.prompts.selectProject(accountId),
    {
      choices: projects.map(p => ({ name: p.name, value: p.name })),
      validate: value =>
        !!value || commands.project.delete.prompts.validation.projectRequired,
    }
  );

  if (!selected) {
    throw new Error(commands.project.delete.prompts.validation.projectRequired);
  }

  return selected;
}

export async function fetchProjectInstallCount(
  accountId: number,
  projectId: number
): Promise<number> {
  try {
    const { data } = await fetchPublicAppsForPortal(accountId);
    return data.results
      .filter(app => app.projectId === projectId)
      .reduce(
        (sum, app) =>
          sum + app.publicApplicationInstallCounts.uniquePortalInstallCount,
        0
      );
  } catch (e) {
    debugError(e);
    uiLogger.warn(commands.project.delete.logs.installCountUnknown);
    return 0;
  }
}

export async function checkDeployedComponents(
  accountId: number,
  projectName: string
): Promise<{
  platformVersion: string;
  hasUnifiedComponents: boolean;
  projectId: number;
}> {
  const { data: projectData } = await fetchProject(accountId, projectName);

  const platformVersion =
    projectData.deployedBuild?.platformVersion ||
    projectData.latestBuild?.platformVersion;

  if (!platformVersion) {
    throw new Error(commands.project.delete.errors.noPlatformVersion);
  }

  if (isLegacyProject(platformVersion)) {
    const userVisibleComponents: string[] = [];
    projectData.deployedBuild?.subbuildStatuses?.forEach(item => {
      if (LEGACY_COMPONENTS_TO_FILTER.includes(item.buildType)) {
        return;
      }
      userVisibleComponents.push(
        `${item.buildName} - (${mapLegacyComponentToUserFriendlyName(item.buildType)})`
      );
    });
    if (userVisibleComponents.length > 0) {
      uiLogger.log(
        commands.project.delete.logs.componentsToDeleteLegacy(
          userVisibleComponents
        )
      );
    }
    return {
      platformVersion,
      hasUnifiedComponents: false,
      projectId: projectData.id,
    };
  }

  try {
    const { data } = await stageProjectForDeletion(
      accountId,
      projectName,
      true
    );

    if (data.hasDeployedComponents) {
      const userVisibleComponents = data.componentsToRemove.filter(
        item =>
          !AUTO_GENERATED_COMPONENT_TYPES.includes(
            mapToUserFacingType(item.componentType)
          )
      );
      uiLogger.log(
        commands.project.delete.logs.componentsToDeleteUnified(
          userVisibleComponents
        )
      );
    }

    return {
      hasUnifiedComponents: data.hasDeployedComponents,
      platformVersion,
      projectId: projectData.id,
    };
  } catch (e) {
    debugError(e);
    throw new Error(
      commands.project.delete.errors.cannotDelete(
        projectName,
        getErrorMessage(e)
      )
    );
  }
}

export async function deleteDeployedComponents(
  accountId: number,
  projectName: string
): Promise<void> {
  SpinniesManager.add('removeComponents', {
    text: commands.project.delete.logs.deletingComponents(projectName),
  });

  let projectDeletionResponse: undefined | ProjectDeletionResponse;

  try {
    const { data } = await stageProjectForDeletion(
      accountId,
      projectName,
      false
    );
    projectDeletionResponse = data;
  } catch (e) {
    debugError(e);
    SpinniesManager.fail('removeComponents', {
      text: commands.project.delete.errors.componentDeletionFailed(projectName),
    });
    throw new Error(
      commands.project.delete.errors.componentDeletionFailed(projectName)
    );
  }

  const { deployId, hasDeployedComponents } = projectDeletionResponse;

  if (deployId === undefined) {
    if (hasDeployedComponents) {
      SpinniesManager.fail('removeComponents', {
        text: commands.project.delete.logs.unableToDetermineIfComponentsWereDeleted(
          projectName
        ),
      });
      throw new Error(
        commands.project.delete.logs.unableToDetermineIfComponentsWereDeleted(
          projectName
        )
      );
    } else {
      SpinniesManager.succeed('removeComponents', {
        text: commands.project.delete.logs.componentsDeleted(projectName),
      });
    }
    return;
  }

  try {
    await poll(
      () => getDeployStatus(accountId, projectName, deployId),
      {
        successStates: DELETION_DEPLOY_SUCCESS_STATES,
        errorStates: DELETION_DEPLOY_ERROR_STATES,
      },
      DELETION_POLL_TIMEOUT_MS
    );
    SpinniesManager.succeed('removeComponents', {
      text: commands.project.delete.logs.componentsDeleted(projectName),
    });
  } catch (e) {
    debugError(e);
    SpinniesManager.fail('removeComponents', {
      text: commands.project.delete.errors.componentDeletionFailed(projectName),
    });
    throw new Error(
      commands.project.delete.errors.componentDeletionFailed(projectName)
    );
  }
}

export async function handleProjectDeletion(
  accountId: number,
  projectName: string
): Promise<void> {
  try {
    SpinniesManager.add('deleteProject', {
      text: commands.project.delete.logs.deleting(projectName),
    });
    await deleteProject(accountId, projectName);
    SpinniesManager.succeed('deleteProject', {
      text: commands.project.delete.logs.deleted(projectName, accountId),
    });
  } catch (e) {
    SpinniesManager.fail('deleteProject', {
      text: commands.project.delete.errors.deleteFailed(projectName),
    });
    throw e;
  }
}

export async function confirmDeletion(
  projectName: string,
  accountId: number,
  projectId: number
): Promise<void> {
  const installCount = await fetchProjectInstallCount(accountId, projectId);
  if (installCount > 0) {
    uiLogger.warn(commands.project.delete.logs.installWarning(installCount));
  }

  const confirmed = await confirmPrompt(
    commands.project.delete.prompts.confirmDelete(projectName, accountId),
    { defaultAnswer: false }
  );

  if (!confirmed) {
    uiLogger.log(commands.project.delete.logs.cancelled);
    throw new PromptExitError(
      commands.project.delete.logs.cancelled,
      EXIT_CODES.SUCCESS
    );
  }
}
