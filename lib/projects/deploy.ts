import { uiLogger } from '../ui/logger.js';
import { commands } from '../../lang/en.js';
import { PROJECT_ERROR_TYPES } from '../constants.js';
import {
  Deploy,
  ProjectDeployResponseBlocked,
} from '@hubspot/local-dev-lib/types/Deploy';
import { deployProject } from '@hubspot/local-dev-lib/api/projects';
import { pollDeployStatus } from './pollProjectBuildAndDeploy.js';

export function validateBuildIdForDeploy(
  buildId: number,
  deployedBuildId: number | undefined,
  latestBuildId: number,
  projectName: string | undefined,
  accountId: number
): boolean | string {
  if (Number(buildId) > latestBuildId) {
    return commands.project.deploy.errors.buildIdDoesNotExist(
      accountId,
      buildId,
      projectName!
    );
  }
  if (Number(buildId) === deployedBuildId) {
    return commands.project.deploy.errors.buildAlreadyDeployed(
      accountId,
      buildId,
      projectName!
    );
  }
  return true;
}

export function logDeployErrors(errorData: {
  message: string;
  errors: Array<{
    message: string;
    subCategory: string;
    context: { COMPONENT_NAME: string };
  }>;
}) {
  uiLogger.error(errorData.message);

  errorData.errors.forEach(err => {
    // This is how the pre-deploy check manifests itself in < 2025.2 projects
    if (err.subCategory === PROJECT_ERROR_TYPES.DEPLOY_CONTAINS_REMOVALS) {
      uiLogger.log(
        commands.project.deploy.errors.deployContainsRemovals(
          err.context.COMPONENT_NAME
        )
      );
    } else {
      uiLogger.log(err.message);
    }
  });
}

function handleBlockedDeploy(deployResp: ProjectDeployResponseBlocked) {
  const deployCanBeForced = deployResp.issues.every(issue =>
    issue.blockingMessages.every(message => message.isWarning)
  );

  uiLogger.log('');

  if (deployCanBeForced) {
    uiLogger.warn(commands.project.deploy.errors.deployWarningsHeader);
    uiLogger.log('');
  } else {
    uiLogger.error(commands.project.deploy.errors.deployBlockedHeader);
    uiLogger.log('');
  }

  deployResp.issues.forEach(issue => {
    if (issue.blockingMessages.length > 0) {
      issue.blockingMessages.forEach(message => {
        uiLogger.log(
          commands.project.deploy.errors.deployIssueComponentWarning(
            issue.uid,
            issue.componentTypeName,
            message.message
          )
        );
      });
    } else {
      uiLogger.log(
        commands.project.deploy.errors.deployIssueComponentGeneric(
          issue.uid,
          issue.componentTypeName
        )
      );
    }
    uiLogger.log('');
  });
}

export async function handleProjectDeploy(
  targetAccountId: number,
  projectName: string,
  buildId: number,
  useV3Api: boolean,
  force: boolean
): Promise<Deploy | undefined> {
  const { data: deployResp } = await deployProject(
    targetAccountId,
    projectName,
    buildId,
    useV3Api,
    force
  );

  if (!deployResp || deployResp.buildResultType !== 'DEPLOY_QUEUED') {
    if (deployResp?.buildResultType === 'DEPLOY_BLOCKED') {
      handleBlockedDeploy(deployResp);
    } else {
      uiLogger.error(commands.project.deploy.errors.deploy);
    }
    return;
  }

  const deployResult = await pollDeployStatus(
    targetAccountId,
    projectName,
    Number(deployResp.id),
    buildId
  );

  return deployResult;
}
