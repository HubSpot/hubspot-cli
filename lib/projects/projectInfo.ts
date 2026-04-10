import chalk from 'chalk';
import { fetchAppMetadataBySourceId } from '@hubspot/local-dev-lib/api/appsDev';
import {
  APP_KEY,
  USER_FACING_TO_INTERNAL_TYPE,
} from '@hubspot/project-parsing-lib/constants';
import { Project } from '@hubspot/local-dev-lib/types/Project';
import { debugError } from '../errorHandlers/index.js';
import { getProjectDetailUrl } from './urls.js';
import { commands } from '../../lang/en.js';
import { uiLine, uiLink } from '../ui/index.js';
import { uiLogger } from '../ui/logger.js';
import { ProjectInfo } from '../../types/Projects.js';

export type { ProjectInfo };

export async function getProjectInfo(
  project: Project,
  platformVersion: string,
  accountId: number
): Promise<ProjectInfo> {
  const deployedBuild = project.deployedBuild!;

  const projectInfo: ProjectInfo = {
    projectName: project.name,
    platformVersion,
    projectId: project.id,
    deployedBuildId: deployedBuild.buildId,
    autoDeployEnabled: deployedBuild.isAutoDeployEnabled,
    components: [],
  };

  const projectUrl = getProjectDetailUrl(project.name, accountId);
  if (projectUrl) {
    projectInfo.projectUrl = projectUrl;
  }

  const appSubbuild = deployedBuild.subbuildStatuses.find(
    s => s.buildType === USER_FACING_TO_INTERNAL_TYPE[APP_KEY]
  );

  if (appSubbuild) {
    try {
      const { data: appMetadata } = await fetchAppMetadataBySourceId(
        project.id,
        appSubbuild.buildName,
        accountId
      );

      projectInfo.app = {
        name: appMetadata.name,
        id: appMetadata.id,
        uid: appSubbuild.buildName,
        authType: appMetadata.authType,
        distributionType: appMetadata.distributionType,
      };
    } catch (err) {
      debugError(err);
    }
  }

  projectInfo.components = deployedBuild.subbuildStatuses
    .filter(s => s.buildType !== USER_FACING_TO_INTERNAL_TYPE[APP_KEY])
    .map(s => ({
      uid: s.buildName,
      type: s.buildType,
    }));

  return projectInfo;
}

export function logProjectInfo(projectInfo: ProjectInfo): void {
  uiLogger.log(
    chalk.bold(commands.project.info.project.title(projectInfo.projectName))
  );
  uiLine();
  uiLogger.log(
    commands.project.info.project.platformVersion(projectInfo.platformVersion)
  );
  uiLogger.log(commands.project.info.project.id(projectInfo.projectId));
  uiLogger.log(
    commands.project.info.project.deployedBuild(projectInfo.deployedBuildId)
  );
  uiLogger.log(
    commands.project.info.project.autoDeploy(projectInfo.autoDeployEnabled)
  );

  if (projectInfo.projectUrl) {
    uiLogger.log('');
    uiLogger.log(
      uiLink(commands.project.info.viewProjectLink, projectInfo.projectUrl)
    );
  }

  if (projectInfo.app) {
    uiLogger.log('');
    uiLogger.log(chalk.bold(commands.project.info.app.title));
    uiLine();
    uiLogger.log(commands.project.info.app.name(projectInfo.app.name));
    uiLogger.log(commands.project.info.app.id(projectInfo.app.id));
    uiLogger.log(commands.project.info.app.uid(projectInfo.app.uid));
    if (projectInfo.app.authType) {
      uiLogger.log(
        commands.project.info.app.authType(projectInfo.app.authType)
      );
    }
    if (projectInfo.app.distributionType) {
      uiLogger.log(
        commands.project.info.app.distributionType(
          projectInfo.app.distributionType
        )
      );
    }
  }

  if (projectInfo.components.length > 0) {
    uiLogger.log('');
    uiLogger.log(chalk.bold(commands.project.info.componentsHeader));
    uiLine();

    const typeColWidth = Math.max(
      commands.project.info.labels.type.length,
      ...projectInfo.components.map(c => c.type.length)
    );

    uiLogger.log(
      `${commands.project.info.labels.type.padEnd(typeColWidth)}   ${commands.project.info.labels.uid}`
    );

    for (const component of projectInfo.components) {
      uiLogger.log(`${component.type.padEnd(typeColWidth)}   ${component.uid}`);
    }
  }
}
