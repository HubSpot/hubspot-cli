import { ArgumentsCamelCase } from 'yargs';
import {
  getConfigAccountById,
  getLinkedOrAllConfigAccounts,
  getConfigAccountEnvironment,
} from '@hubspot/local-dev-lib/config';
import {
  getHsSettingsFileIfExists,
  getHsSettingsFilePath,
} from '@hubspot/local-dev-lib/config/hsSettings';

import {
  findProjectComponents,
  getProjectComponentTypes,
} from '../../../lib/projects/structure.js';
import { ComponentTypes, ProjectConfig } from '../../../types/Projects.js';
import { commands } from '../../../lang/en.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import LocalDevManager_DEPRECATED from '../../../lib/projects/localDev/LocalDevManager_DEPRECATED.js';
import {
  confirmDefaultAccountIsTarget,
  suggestRecommendedNestedAccount,
  checkIfAccountFlagIsSupported,
  checkIfDefaultAccountIsSupported,
  createSandboxForLocalDev,
  createDeveloperTestAccountForLocalDev,
  useExistingDevTestAccount,
  checkIfParentAccountIsAuthed,
  hasSandboxes,
} from '../../../lib/projects/localDev/helpers/account.js';
import {
  createInitialBuildForNewProject,
  createNewProjectForLocalDev,
} from '../../../lib/projects/localDev/helpers/project.js';
import { handleExit } from '../../../lib/process.js';
import { getErrorMessage } from '../../../lib/errorHandlers/index.js';
import {
  isSandbox,
  isDeveloperTestAccount,
} from '../../../lib/accountTypes.js';
import { ensureProjectExists } from '../../../lib/projects/ensureProjectExists.js';
import { ProjectDevArgs } from '../../../types/Yargs.js';
import {
  isDirectoryLinked,
  addAccountToLinkedSettings,
} from '../../../lib/link/linkUtils.js';

type DeprecatedProjectDevFlowArgs = {
  args: ArgumentsCamelCase<ProjectDevArgs>;
  accountId: number;
  projectConfig: ProjectConfig;
  projectDir: string;
};

export async function deprecatedProjectDevFlow({
  args,
  accountId,
  projectConfig,
  projectDir,
}: DeprecatedProjectDevFlowArgs): Promise<void> {
  const { userProvidedAccount, derivedAccountId, exit } = args;
  const env = getConfigAccountEnvironment(derivedAccountId);

  const components = await findProjectComponents(projectDir);
  const runnableComponents = components.filter(component => component.runnable);
  const componentTypes = getProjectComponentTypes(runnableComponents);
  const hasPrivateApps = !!componentTypes[ComponentTypes.PrivateApp];
  const hasPublicApps = !!componentTypes[ComponentTypes.PublicApp];

  const accountConfig = getConfigAccountById(accountId);
  if (!accountConfig) {
    uiLogger.error(commands.project.dev.errors.noAccount(accountId));
    return exit(EXIT_CODES.ERROR);
  }

  if (runnableComponents.length === 0) {
    uiLogger.error(commands.project.dev.errors.noRunnableComponents);
    return exit(EXIT_CODES.SUCCESS);
  } else if (hasPrivateApps && hasPublicApps) {
    uiLogger.error(commands.project.dev.errors.invalidProjectComponents);
    return exit(EXIT_CODES.SUCCESS);
  }

  const hsSettings = getHsSettingsFileIfExists();
  const directoryIsLinked = isDirectoryLinked(hsSettings);
  const accounts = getLinkedOrAllConfigAccounts();

  if (!accounts) {
    uiLogger.error(commands.project.dev.errors.noAccountsInConfig);
    return exit(EXIT_CODES.ERROR);
  }

  let bypassRecommendedAccountPrompt = false;

  if (isDeveloperTestAccount(accountConfig)) {
    bypassRecommendedAccountPrompt = true;
  } else if (!hasPublicApps && isSandbox(accountConfig)) {
    bypassRecommendedAccountPrompt = true;
  } else if (!hasPublicApps) {
    const defaultAccountHasSandboxes = await hasSandboxes(accountConfig);
    bypassRecommendedAccountPrompt = !defaultAccountHasSandboxes;
  }

  // targetProjectAccountId and targetTestingAccountId are set to null if --account flag is not provided.
  // By setting them to null, we can later check if they need to be assigned based on the default account configuration and the type of app.
  let targetProjectAccountId = userProvidedAccount ? derivedAccountId : null;
  // The account that we are locally testing against
  let targetTestingAccountId = userProvidedAccount ? derivedAccountId : null;

  // Check that the default account or flag option is valid for the type of app in this project
  if (userProvidedAccount) {
    try {
      checkIfAccountFlagIsSupported(accountConfig, hasPublicApps);
    } catch (e) {
      uiLogger.error(getErrorMessage(e));
      return exit(EXIT_CODES.SUCCESS);
    }

    if (hasPublicApps) {
      targetProjectAccountId = accountConfig.parentAccountId || null;
    }
  } else {
    await checkIfDefaultAccountIsSupported(accountConfig, hasPublicApps, exit);
  }

  if (directoryIsLinked) {
    uiLogger.log('');
    uiLogger.info(
      commands.account.subcommands.link.shared.usingLinkedAccounts(
        getHsSettingsFilePath()!
      )
    );
  }

  // The user is targeting an account type that we recommend developing on
  if (!targetProjectAccountId && bypassRecommendedAccountPrompt) {
    targetTestingAccountId = derivedAccountId;

    await confirmDefaultAccountIsTarget(accountConfig, exit);

    if (hasPublicApps) {
      try {
        checkIfParentAccountIsAuthed(accountConfig);
      } catch (e) {
        uiLogger.error(getErrorMessage(e));
        return exit(EXIT_CODES.SUCCESS);
      }
      targetProjectAccountId = accountConfig.parentAccountId || null;
    } else {
      targetProjectAccountId = derivedAccountId;
    }
  }

  let createNewSandbox = false;
  let createNewDeveloperTestAccount = false;

  if (!targetProjectAccountId) {
    const {
      targetAccountId,
      parentAccountId,
      createNestedAccount,
      notInConfigAccount,
    } = await suggestRecommendedNestedAccount(
      accounts,
      accountConfig,
      hasPublicApps
    );

    targetProjectAccountId = hasPublicApps
      ? parentAccountId || null
      : targetAccountId;
    targetTestingAccountId = targetAccountId;

    // Only used for developer test accounts that are not yet in the config
    if (notInConfigAccount) {
      const accountAdded = await useExistingDevTestAccount(
        env,
        notInConfigAccount
      );
      if (!accountAdded) {
        return exit(EXIT_CODES.SUCCESS);
      }
      if (directoryIsLinked) {
        addAccountToLinkedSettings(notInConfigAccount.id);
      }
    }

    createNewSandbox = hasPrivateApps && createNestedAccount;
    createNewDeveloperTestAccount = hasPublicApps && createNestedAccount;
  }

  if (createNewSandbox) {
    try {
      targetProjectAccountId = await createSandboxForLocalDev(
        derivedAccountId,
        accountConfig,
        env
      );
    } catch {
      return exit(EXIT_CODES.ERROR);
    }
    // We will be running our tests against this new sandbox account
    targetTestingAccountId = targetProjectAccountId;
    if (directoryIsLinked) {
      addAccountToLinkedSettings(targetProjectAccountId);
    }
  }
  if (createNewDeveloperTestAccount) {
    try {
      targetTestingAccountId = await createDeveloperTestAccountForLocalDev(
        derivedAccountId,
        accountConfig,
        env,
        false
      );
    } catch {
      return exit(EXIT_CODES.ERROR);
    }
    targetProjectAccountId = derivedAccountId;
    if (directoryIsLinked) {
      addAccountToLinkedSettings(targetTestingAccountId);
    }
  }

  if (!targetProjectAccountId || !targetTestingAccountId) {
    uiLogger.error(commands.project.dev.errors.noAccount(accountId));
    return exit(EXIT_CODES.ERROR);
  }

  // eslint-disable-next-line prefer-const
  let { projectExists, project } = await ensureProjectExists(
    targetProjectAccountId,
    projectConfig.name,
    {
      allowCreate: false,
      noLogs: true,
      withPolling: createNewSandbox,
    }
  );

  let deployedBuild;
  let isGithubLinked = false;

  if (projectExists && project) {
    deployedBuild = project.deployedBuild;
    isGithubLinked = Boolean(
      project.sourceIntegration && project.sourceIntegration.source === 'GITHUB'
    );
  } else {
    project = await createNewProjectForLocalDev(
      projectConfig,
      targetProjectAccountId,
      createNewSandbox,
      hasPublicApps,
      exit
    );

    deployedBuild = await createInitialBuildForNewProject(
      projectConfig,
      projectDir,
      targetProjectAccountId,
      exit
    );
  }

  const LocalDev = new LocalDevManager_DEPRECATED({
    runnableComponents,
    debug: args.debug,
    deployedBuild,
    isGithubLinked,
    parentAccountId: targetProjectAccountId,
    projectConfig,
    projectDir,
    projectId: project!.id,
    targetAccountId: targetTestingAccountId,
    env,
    exit,
    port: args.port,
  });

  await LocalDev.start();

  handleExit(({ isSIGHUP }) => LocalDev.stop(!isSIGHUP));
}
