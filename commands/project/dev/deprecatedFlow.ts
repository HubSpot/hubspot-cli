import { ArgumentsCamelCase } from 'yargs';
import {
  getAccountConfig,
  getConfigAccounts,
  getEnv,
} from '@hubspot/local-dev-lib/config';
import { getValidEnv } from '@hubspot/local-dev-lib/environment';

import {
  findProjectComponents,
  getProjectComponentTypes,
} from '../../../lib/projects/structure.js';
import { ComponentTypes, ProjectConfig } from '../../../types/Projects.js';
import { commands } from '../../../lang/en.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import SpinniesManager from '../../../lib/ui/SpinniesManager.js';
import LocalDevManager from '../../../lib/projects/localDev/LocalDevManager.js';
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
import {
  isSandbox,
  isDeveloperTestAccount,
} from '../../../lib/accountTypes.js';
import { ensureProjectExists } from '../../../lib/projects/ensureProjectExists.js';
import { ProjectDevArgs } from '../../../types/Yargs.js';

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
  const { userProvidedAccount, derivedAccountId } = args;
  const env = getValidEnv(getEnv(derivedAccountId));

  const components = await findProjectComponents(projectDir);
  const runnableComponents = components.filter(component => component.runnable);
  const componentTypes = getProjectComponentTypes(runnableComponents);
  const hasPrivateApps = !!componentTypes[ComponentTypes.PrivateApp];
  const hasPublicApps = !!componentTypes[ComponentTypes.PublicApp];

  const accountConfig = getAccountConfig(accountId);
  if (!accountConfig) {
    uiLogger.error(commands.project.dev.errors.noAccount(accountId));
    process.exit(EXIT_CODES.ERROR);
  }

  if (runnableComponents.length === 0) {
    uiLogger.error(commands.project.dev.errors.noRunnableComponents);
    process.exit(EXIT_CODES.SUCCESS);
  } else if (hasPrivateApps && hasPublicApps) {
    uiLogger.error(commands.project.dev.errors.invalidProjectComponents);
    process.exit(EXIT_CODES.SUCCESS);
  }

  const accounts = getConfigAccounts();

  if (!accounts) {
    uiLogger.error(commands.project.dev.errors.noAccountsInConfig);
    process.exit(EXIT_CODES.ERROR);
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
    checkIfAccountFlagIsSupported(accountConfig, hasPublicApps);

    if (hasPublicApps) {
      targetProjectAccountId = accountConfig.parentAccountId || null;
    }
  } else {
    await checkIfDefaultAccountIsSupported(accountConfig, hasPublicApps);
  }

  // The user is targeting an account type that we recommend developing on
  if (!targetProjectAccountId && bypassRecommendedAccountPrompt) {
    targetTestingAccountId = derivedAccountId;

    await confirmDefaultAccountIsTarget(accountConfig);

    if (hasPublicApps) {
      checkIfParentAccountIsAuthed(accountConfig);
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
      await useExistingDevTestAccount(env, notInConfigAccount);
    }

    createNewSandbox = hasPrivateApps && createNestedAccount;
    createNewDeveloperTestAccount = hasPublicApps && createNestedAccount;
  }

  if (createNewSandbox) {
    targetProjectAccountId = await createSandboxForLocalDev(
      derivedAccountId,
      accountConfig,
      env
    );
    // We will be running our tests against this new sandbox account
    targetTestingAccountId = targetProjectAccountId;
  }
  if (createNewDeveloperTestAccount) {
    targetTestingAccountId = await createDeveloperTestAccountForLocalDev(
      derivedAccountId,
      accountConfig,
      env
    );
    targetProjectAccountId = derivedAccountId;
  }

  if (!targetProjectAccountId || !targetTestingAccountId) {
    uiLogger.error(commands.project.dev.errors.noAccount(accountId));
    process.exit(EXIT_CODES.ERROR);
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

  SpinniesManager.init();

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
      hasPublicApps
    );

    deployedBuild = await createInitialBuildForNewProject(
      projectConfig,
      projectDir,
      targetProjectAccountId
    );
  }

  const LocalDev = new LocalDevManager({
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
  });

  await LocalDev.start();

  handleExit(({ isSIGHUP }) => LocalDev.stop(!isSIGHUP));
}
