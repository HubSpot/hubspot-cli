import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../lib/commonOpts';
import { trackCommandUsage } from '../../lib/usageTracking';
import { handleExit } from '../../lib/process';
import { i18n } from '../../lib/lang';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  getConfigAccounts,
  getAccountConfig,
  getEnv,
} from '@hubspot/local-dev-lib/config';
import {
  getProjectConfig,
  ensureProjectExists,
  validateProjectConfig,
} from '../../lib/projects';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { uiBetaTag, uiCommandReference, uiLink } from '../../lib/ui';
import SpinniesManager from '../../lib/ui/SpinniesManager';
import LocalDevManager from '../../lib/LocalDevManager';
import {
  isSandbox,
  isDeveloperTestAccount,
  isStandardAccount,
  isAppDeveloperAccount,
} from '../../lib/accountTypes';
import { getValidEnv } from '@hubspot/local-dev-lib/environment';
import { ComponentTypes } from '../../types/Projects';
import {
  findProjectComponents,
  getProjectComponentTypes,
} from '../../lib/projects/structure';
import {
  confirmDefaultAccountIsTarget,
  suggestRecommendedNestedAccount,
  checkIfDefaultAccountIsSupported,
  createSandboxForLocalDev,
  createDeveloperTestAccountForLocalDev,
  createNewProjectForLocalDev,
  createInitialBuildForNewProject,
  useExistingDevTestAccount,
  checkIfAccountFlagIsSupported,
  checkIfParentAccountIsAuthed,
} from '../../lib/localDev';
import { ArgumentsCamelCase, Argv } from 'yargs';
import { CommonArgs, ConfigArgs, EnvironmentArgs } from '../../types/Yargs';

const i18nKey = 'commands.project.subcommands.dev';

export const command = 'dev';
export const describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

type ProjectDevArgs = CommonArgs & ConfigArgs & EnvironmentArgs;

export async function handler(args: ArgumentsCamelCase<ProjectDevArgs>) {
  const { derivedAccountId, providedAccountId } = args;
  const accountConfig = getAccountConfig(derivedAccountId);
  const env = getValidEnv(getEnv(derivedAccountId));

  trackCommandUsage('project-dev', {}, derivedAccountId);

  const { projectConfig, projectDir } = await getProjectConfig();

  uiBetaTag(i18n(`${i18nKey}.logs.betaMessage`));

  logger.log(
    uiLink(
      i18n(`${i18nKey}.logs.learnMoreLocalDevServer`),
      'https://developers.hubspot.com/docs/platform/project-cli-commands#start-a-local-development-server'
    )
  );

  if (!projectConfig || !projectDir) {
    logger.error(
      i18n(`${i18nKey}.errors.noProjectConfig`, {
        accountId: derivedAccountId,
        authCommand: uiCommandReference('hs auth'),
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  if (!accountConfig) {
    logger.error(i18n(`${i18nKey}.errors.noAccount`));
    process.exit(EXIT_CODES.ERROR);
  }

  validateProjectConfig(projectConfig, projectDir);

  const components = await findProjectComponents(projectDir);
  const runnableComponents = components.filter(component => component.runnable);
  const componentTypes = getProjectComponentTypes(runnableComponents);
  const hasPrivateApps = !!componentTypes[ComponentTypes.PrivateApp];
  const hasPublicApps = !!componentTypes[ComponentTypes.PublicApp];

  if (runnableComponents.length === 0) {
    logger.error(
      i18n(`${i18nKey}.errors.noRunnableComponents`, {
        projectDir,
        command: uiCommandReference('hs project add'),
      })
    );
    process.exit(EXIT_CODES.SUCCESS);
  } else if (hasPrivateApps && hasPublicApps) {
    logger.error(i18n(`${i18nKey}.errors.invalidProjectComponents`));
    process.exit(EXIT_CODES.SUCCESS);
  }

  const accounts = getConfigAccounts();

  if (!accounts) {
    logger.error(
      i18n(`${i18nKey}.errors.noAccountsInConfig`, {
        authCommand: uiCommandReference('hs auth'),
      })
    );
    process.exit(EXIT_CODES.SUCCESS);
  }

  const defaultAccountIsRecommendedType =
    isDeveloperTestAccount(accountConfig) ||
    (!hasPublicApps && isSandbox(accountConfig));

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
    checkIfDefaultAccountIsSupported(accountConfig, hasPublicApps);
  }

  // The user is targeting an account type that we recommend developing on
  if (!targetProjectAccountId && defaultAccountIsRecommendedType) {
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

    createNewSandbox = isStandardAccount(accountConfig) && createNestedAccount;
    createNewDeveloperTestAccount =
      isAppDeveloperAccount(accountConfig) && createNestedAccount;
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
    logger.error(i18n(`${i18nKey}.errors.noAccount`));
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

export function builder(yargs: Argv): Argv<ProjectDevArgs> {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs.example([['$0 project dev', i18n(`${i18nKey}.examples.default`)]]);

  return yargs as Argv<ProjectDevArgs>;
}
