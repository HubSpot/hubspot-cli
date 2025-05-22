import { ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  getAccountConfig,
  getConfigAccounts,
  getEnv,
} from '@hubspot/local-dev-lib/config';

import { getValidEnv } from '@hubspot/local-dev-lib/environment';

import {
  findProjectComponents,
  getProjectComponentTypes,
} from '../../../lib/projects/structure';
import { ComponentTypes, ProjectConfig } from '../../../types/Projects';
import { i18n } from '../../../lib/lang';
import { EXIT_CODES } from '../../../lib/enums/exitCodes';
import { uiCommandReference } from '../../../lib/ui';
import SpinniesManager from '../../../lib/ui/SpinniesManager';
import LocalDevManager from '../../../lib/projects/localDev/LocalDevManager';
import {
  confirmDefaultAccountIsTarget,
  suggestRecommendedNestedAccount,
  checkIfAccountFlagIsSupported,
  checkIfDefaultAccountIsSupported,
  createSandboxForLocalDev,
  createDeveloperTestAccountForLocalDev,
  createNewProjectForLocalDev,
  createInitialBuildForNewProject,
  useExistingDevTestAccount,
  checkIfParentAccountIsAuthed,
  hasSandboxes,
} from '../../../lib/projects/localDev/helpers';
import { handleExit } from '../../../lib/process';
import { isSandbox, isDeveloperTestAccount } from '../../../lib/accountTypes';
import { ensureProjectExists } from '../../../lib/projects/ensureProjectExists';
import { ProjectDevArgs } from '../../../types/Yargs';

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
  const { providedAccountId, derivedAccountId } = args;
  const env = getValidEnv(getEnv(derivedAccountId));

  const components = await findProjectComponents(projectDir);
  const runnableComponents = components.filter(component => component.runnable);
  const componentTypes = getProjectComponentTypes(runnableComponents);
  const hasPrivateApps = !!componentTypes[ComponentTypes.PrivateApp];
  const hasPublicApps = !!componentTypes[ComponentTypes.PublicApp];

  const accountConfig = getAccountConfig(accountId);
  if (!accountConfig) {
    logger.error(
      i18n('commands.project.subcommands.dev.errors.noAccount', {
        accountId: accountId,
        authCommand: uiCommandReference('hs auth'),
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  if (runnableComponents.length === 0) {
    logger.error(
      i18n(`commands.project.subcommands.dev.errors.noRunnableComponents`, {
        projectDir,
        command: uiCommandReference('hs project add'),
      })
    );
    process.exit(EXIT_CODES.SUCCESS);
  } else if (hasPrivateApps && hasPublicApps) {
    logger.error(
      i18n(`commands.project.subcommands.dev.errors.invalidProjectComponents`)
    );
    process.exit(EXIT_CODES.SUCCESS);
  }

  const accounts = getConfigAccounts();

  if (!accounts) {
    logger.error(
      i18n(`commands.project.subcommands.dev.errors.noAccountsInConfig`, {
        authCommand: uiCommandReference('hs auth'),
      })
    );
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
  let targetProjectAccountId = providedAccountId ? derivedAccountId : null;
  // The account that we are locally testing against
  let targetTestingAccountId = providedAccountId ? derivedAccountId : null;

  // Check that the default account or flag option is valid for the type of app in this project
  if (providedAccountId) {
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
      accountId,
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
    logger.error(i18n(`commands.project.subcommands.dev.errors.noAccount`));
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
