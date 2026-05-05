import path from 'path';
import { ArgumentsCamelCase, Argv } from 'yargs';
import { fetchAppInstallationData } from '@hubspot/local-dev-lib/api/localDevAuth';
import { fetchProject } from '@hubspot/local-dev-lib/api/projects';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import { isLegacyProject } from '@hubspot/project-parsing-lib/projects';
import { translateForLocalDev } from '@hubspot/project-parsing-lib/translate';

import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  JSONOutputArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsHandlerWithUsageTracking } from '../../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { uiLogger } from '../../lib/ui/logger.js';
import {
  ApiErrorContext,
  debugError,
  logError,
} from '../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { commands } from '../../lang/en.js';
import { getProjectConfig } from '../../lib/projects/config.js';
import { isAppIRNode } from '../../lib/projects/structure.js';
import { APP_AUTH_TYPES } from '../../lib/constants.js';
import { AppIRNode } from '../../types/ProjectComponents.js';

const command = 'app-install-status';
const describe = commands.project.installStatus.describe;

type ProjectInstallStatusArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  JSONOutputArgs;

async function handler(
  args: ArgumentsCamelCase<ProjectInstallStatusArgs>
): Promise<void> {
  const { derivedAccountId, formatOutputAsJson, exit } = args;

  const { projectConfig, projectDir } = await getProjectConfig();

  if (!projectConfig || !projectDir) {
    uiLogger.error(commands.project.installStatus.errors.noProjectConfig);
    return exit(EXIT_CODES.ERROR);
  }

  if (isLegacyProject(projectConfig.platformVersion)) {
    uiLogger.error(
      commands.project.installStatus.errors.unsupportedPlatformVersion(
        projectConfig.platformVersion
      )
    );
    return exit(EXIT_CODES.ERROR);
  }

  let appNode: AppIRNode | undefined;
  try {
    const { intermediateNodesIndexedByUid } = await translateForLocalDev(
      {
        projectSourceDir: path.join(projectDir, projectConfig.srcDir),
        platformVersion: projectConfig.platformVersion,
        accountId: derivedAccountId,
      },
      { skipValidation: true }
    );
    appNode = Object.values(intermediateNodesIndexedByUid).find(isAppIRNode);
  } catch (error) {
    debugError(error);
    uiLogger.error(commands.project.installStatus.errors.failedToParseProject);
    return exit(EXIT_CODES.ERROR);
  }

  if (!appNode) {
    uiLogger.error(commands.project.installStatus.errors.noAppInProject);
    return exit(EXIT_CODES.ERROR);
  }

  if (appNode.config.auth.type.toLowerCase() !== APP_AUTH_TYPES.STATIC) {
    uiLogger.error(
      commands.project.installStatus.errors.unsupportedAuthType(
        appNode.config.auth.type
      )
    );
    return exit(EXIT_CODES.ERROR);
  }

  let projectId: number;
  try {
    const response = await fetchProject(derivedAccountId, projectConfig.name);
    projectId = response.data.id;
  } catch (error) {
    logError(
      error,
      new ApiErrorContext({
        accountId: derivedAccountId,
        projectName: projectConfig.name,
      })
    );
    return exit(EXIT_CODES.ERROR);
  }

  let isInstalledWithScopeGroups = false;
  let previouslyAuthorizedScopeGroups: Array<{ id: number; name: string }> = [];
  let appId: number | undefined;
  try {
    const response = await fetchAppInstallationData(
      derivedAccountId,
      projectId,
      appNode.uid,
      appNode.config.auth.requiredScopes,
      appNode.config.auth.optionalScopes
    );
    isInstalledWithScopeGroups = response.data.isInstalledWithScopeGroups;
    previouslyAuthorizedScopeGroups =
      response.data.previouslyAuthorizedScopeGroups;
    appId = response.data.appId;
  } catch (error) {
    if (!isHubSpotHttpError(error) || error.status !== 404) {
      logError(
        error,
        new ApiErrorContext({
          accountId: derivedAccountId,
          projectName: projectConfig.name,
        })
      );
      return exit(EXIT_CODES.ERROR);
    }
  }

  const isInstalled =
    isInstalledWithScopeGroups || previouslyAuthorizedScopeGroups.length > 0;

  if (formatOutputAsJson) {
    uiLogger.json({
      appId,
      appUid: appNode.uid,
      accountId: derivedAccountId,
      projectId,
      isInstalled,
      isInstalledWithCurrentScopes: isInstalledWithScopeGroups,
      previouslyAuthorizedScopeGroups,
    });
    return exit(isInstalled ? EXIT_CODES.SUCCESS : EXIT_CODES.WARNING);
  }

  if (isInstalled) {
    if (isInstalledWithScopeGroups) {
      uiLogger.success(
        commands.project.installStatus.success.installed(
          appNode.config.name,
          derivedAccountId
        )
      );
    } else {
      uiLogger.success(
        commands.project.installStatus.success.installedWithOutdatedScopes(
          appNode.config.name,
          derivedAccountId
        )
      );
    }
    return exit(EXIT_CODES.SUCCESS);
  }

  uiLogger.log(
    commands.project.installStatus.notInstalled(
      appNode.config.name,
      derivedAccountId
    )
  );
  return exit(EXIT_CODES.WARNING);
}

function projectInstallStatusBuilder(
  yargs: Argv
): Argv<ProjectInstallStatusArgs> {
  yargs.example([
    [
      '$0 project app-install-status',
      commands.project.installStatus.examples.default,
    ],
    [
      '$0 project app-install-status --json',
      commands.project.installStatus.examples.json,
    ],
  ]);
  return yargs as Argv<ProjectInstallStatusArgs>;
}

const builder = makeYargsBuilder<ProjectInstallStatusArgs>(
  projectInstallStatusBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useJSONOutputOptions: true,
  }
);

const projectInstallStatusCommand: YargsCommandModule<
  unknown,
  ProjectInstallStatusArgs
> = {
  command,
  describe,
  handler: makeYargsHandlerWithUsageTracking(
    'project-app-install-status',
    handler
  ),
  builder,
};

export default projectInstallStatusCommand;
