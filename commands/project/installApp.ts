import { ArgumentsCamelCase, Argv } from 'yargs';
import { getConfigAccountIfExists } from '@hubspot/local-dev-lib/config';
import { isLegacyProject } from '@hubspot/project-parsing-lib/projects';

import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  JSONOutputArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeWrappedYargsHandler } from '../../lib/yargs/makeWrappedYargsHandler.js';
import {
  InstallAppJsonOutput,
  InstallAppSchema,
} from '../../lib/jsonOutput.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { commands } from '../../lang/en.js';
import { getProjectConfig } from '../../lib/projects/config.js';
import { APP_INSTALLATION_STATES } from '../../lib/constants.js';
import { getAppInstallationState } from '../../lib/app/install.js';
import {
  confirmInstallAppAction,
  fetchProjectAppInstallationData,
  installStaticAuthAppForAccount,
  loadInstallableAppNode,
  resolveAppMetadata,
  resolveProjectId,
  resolveProjectAccountId,
  resolveValidInstallAccount,
} from '../../lib/projects/installApp.js';

const command = 'install-app';
const describe = commands.project.installApp.describe;
const verboseDescribe = commands.project.installApp.verboseDescribe;

export type ProjectInstallAppArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs &
  JSONOutputArgs<InstallAppJsonOutput> & {
    force: boolean;
    profile?: string;
  };

async function handler(
  args: ArgumentsCamelCase<ProjectInstallAppArgs>
): Promise<void> {
  const {
    derivedAccountId,
    formatOutputAsJson,
    force,
    profile: profileOption,
    useEnv: useEnvOption,
    exit,
    addJsonOutput,
  } = args;

  const { projectConfig, projectDir } = await getProjectConfig();

  if (!projectConfig || !projectDir) {
    uiLogger.error(commands.project.installApp.errors.noProjectConfig);
    return exit(EXIT_CODES.ERROR);
  }

  if (isLegacyProject(projectConfig.platformVersion)) {
    uiLogger.error(
      commands.project.installApp.errors.unsupportedPlatformVersion(
        projectConfig.platformVersion
      )
    );
    return exit(EXIT_CODES.ERROR);
  }

  const resolvedProjectAccount = await resolveProjectAccountId(
    derivedAccountId,
    projectConfig,
    projectDir,
    profileOption,
    !!useEnvOption
  );
  if (resolvedProjectAccount === null) {
    return exit(EXIT_CODES.ERROR);
  }

  const appNode = await loadInstallableAppNode(
    projectConfig,
    projectDir,
    resolvedProjectAccount.accountId,
    force
  );
  if (!appNode) {
    return exit(EXIT_CODES.ERROR);
  }

  const installAccountId = await resolveValidInstallAccount(
    resolvedProjectAccount.accountId,
    force,
    Boolean(formatOutputAsJson)
  );
  if (installAccountId === null) {
    return exit(EXIT_CODES.ERROR);
  }

  const targetAccountConfig = getConfigAccountIfExists(installAccountId);

  // A profile only applies if we didn't switch away from its account.
  const uploadProfile =
    installAccountId === resolvedProjectAccount.accountId
      ? resolvedProjectAccount.profileName
      : undefined;

  const projectId = await resolveProjectId({
    accountId: installAccountId,
    projectConfig,
    projectDir,
    profile: uploadProfile,
    force,
    formatOutputAsJson: Boolean(formatOutputAsJson),
  });
  if (projectId === null) {
    return exit(EXIT_CODES.ERROR);
  }

  const installationData = await fetchProjectAppInstallationData(
    installAccountId,
    projectId,
    appNode,
    projectConfig
  );
  if (installationData === null) {
    return exit(EXIT_CODES.ERROR);
  }

  let appId = installationData.appId;
  const { isInstalledWithScopeGroups, previouslyAuthorizedScopeGroups } =
    installationData;

  const needsReinstall =
    !isInstalledWithScopeGroups && previouslyAuthorizedScopeGroups.length > 0;
  const installationState = getAppInstallationState(
    isInstalledWithScopeGroups,
    previouslyAuthorizedScopeGroups
  );

  if (isInstalledWithScopeGroups) {
    addJsonOutput({
      appId,
      appUid: appNode.uid,
      accountId: installAccountId,
      projectId,
      installationState,
      installed: true,
      reinstalled: false,
    });
    if (!formatOutputAsJson) {
      uiLogger.success(
        commands.project.installApp.alreadyInstalled(
          appNode.config.name,
          installAccountId
        )
      );
    }
    return exit(EXIT_CODES.SUCCESS);
  }

  const shouldInstall = await confirmInstallAppAction({
    appName: appNode.config.name,
    targetAccountId: installAccountId,
    force,
    needsReinstall,
  });
  if (!shouldInstall) {
    return exit(EXIT_CODES.SUCCESS);
  }

  const metadata = await resolveAppMetadata({
    appId,
    projectId,
    appUid: appNode.uid,
    appName: appNode.config.name,
    accountId: installAccountId,
    projectConfig,
    projectDir,
    profile: uploadProfile,
    force,
    formatOutputAsJson: Boolean(formatOutputAsJson),
  });
  if (metadata === null) {
    return exit(EXIT_CODES.ERROR);
  }
  appId = metadata.appId;

  const installed = await installStaticAuthAppForAccount({
    appId,
    appNode,
    appName: appNode.config.name,
    targetAccountId: installAccountId,
    targetAccountConfig,
    projectId,
    projectName: projectConfig.name,
    scopeGroupIds: metadata.scopeGroupIds,
    ownerPortalId: metadata.ownerPortalId,
    installationState,
    formatOutputAsJson: Boolean(formatOutputAsJson),
  });
  if (!installed) {
    return exit(EXIT_CODES.ERROR);
  }

  addJsonOutput({
    appId,
    appUid: appNode.uid,
    accountId: installAccountId,
    projectId,
    installationState: APP_INSTALLATION_STATES.INSTALLED,
    installed: true,
    reinstalled: needsReinstall,
  });
  if (!formatOutputAsJson) {
    uiLogger.success(
      commands.project.installApp.success(appNode.config.name, installAccountId)
    );
  }
  return exit(EXIT_CODES.SUCCESS);
}

function projectInstallAppBuilder(yargs: Argv): Argv<ProjectInstallAppArgs> {
  yargs.options({
    force: {
      alias: ['f'],
      describe: commands.project.installApp.options.force,
      default: false,
      type: 'boolean',
    },
    profile: {
      alias: 'p',
      describe: commands.project.installApp.options.profile,
      type: 'string',
    },
  });

  yargs.conflicts('profile', 'account');

  yargs.example([
    ['$0 project install-app', commands.project.installApp.examples.default],
    [
      '$0 project install-app --account=12345678',
      commands.project.installApp.examples.withAccount,
    ],
    [
      '$0 project install-app --profile=qa',
      commands.project.installApp.examples.withProfile,
    ],
    [
      '$0 project install-app --json',
      commands.project.installApp.examples.json,
    ],
  ]);
  return yargs as Argv<ProjectInstallAppArgs>;
}

const builder = makeYargsBuilder<ProjectInstallAppArgs>(
  projectInstallAppBuilder,
  command,
  verboseDescribe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
    useJSONOutputOptions: true,
  }
);

const projectInstallAppCommand: YargsCommandModule<
  unknown,
  ProjectInstallAppArgs
> = {
  command,
  describe,
  handler: makeWrappedYargsHandler('project-install-app', handler, {
    jsonOutputSchema: InstallAppSchema,
  }),
  builder,
};

export default projectInstallAppCommand;
