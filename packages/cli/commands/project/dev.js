const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
  addTestingOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');
const { handleExit } = require('../../lib/process');
const { i18n } = require('../../lib/lang');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  getConfigAccounts,
  getAccountConfig,
  getEnv,
} = require('@hubspot/local-dev-lib/config');
const { fetchProject } = require('@hubspot/local-dev-lib/api/projects');
const {
  getProjectConfig,
  ensureProjectExists,
  validateProjectConfig,
} = require('../../lib/projects');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { uiBetaTag } = require('../../lib/ui');
const SpinniesManager = require('../../lib/ui/SpinniesManager');
const LocalDevManager = require('../../lib/LocalDevManager');
const {
  isSandbox,
  isDeveloperTestAccount,
  isStandardAccount,
  isAppDeveloperAccount,
} = require('../../lib/accountTypes');
const { getValidEnv } = require('@hubspot/local-dev-lib/environment');

const {
  findProjectComponents,
  getProjectComponentTypes,
  COMPONENT_TYPES,
} = require('../../lib/projectStructure');
const {
  confirmDefaultAccountIsTarget,
  suggestRecommendedNestedAccount,
  checkIfAppDeveloperAccount,
  createSandboxForLocalDev,
  createDeveloperTestAccountForLocalDev,
  createNewProjectForLocalDev,
  createInitialBuildForNewProject,
} = require('../../lib/localDev');

const i18nKey = 'cli.commands.project.subcommands.dev';

exports.command = 'dev [--account]';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  await loadAndValidateOptions(options);
  const accountId = getAccountId(options);
  const accountConfig = getAccountConfig(accountId);
  const env = getValidEnv(getEnv(accountId));

  trackCommandUsage('project-dev', null, accountId);

  const { projectConfig, projectDir } = await getProjectConfig();

  uiBetaTag(i18n(`${i18nKey}.logs.betaMessage`));

  if (!projectConfig) {
    logger.error(i18n(`${i18nKey}.errors.noProjectConfig`));
    process.exit(EXIT_CODES.ERROR);
  }

  validateProjectConfig(projectConfig, projectDir);

  const components = await findProjectComponents(projectDir);
  const componentTypes = getProjectComponentTypes(components);
  const hasPrivateApps = componentTypes[COMPONENT_TYPES.privateApp];
  const hasPublicApps = componentTypes[COMPONENT_TYPES.publicApp];

  if (hasPrivateApps && hasPublicApps) {
    logger.error(i18n(`${i18nKey}.errors.invalidProjectComponents`));
    process.exit(EXIT_CODES.SUCCESS);
  }

  const accounts = getConfigAccounts();

  const defaultAccountIsRecommendedType =
    isDeveloperTestAccount(accountConfig) ||
    (!hasPublicApps && isSandbox(accountConfig));

  let targetAccountId = options.account ? accountId : null;
  let createNewSandbox = false;
  let createNewDeveloperTestAccount = false;

  if (!targetAccountId && defaultAccountIsRecommendedType) {
    await confirmDefaultAccountIsTarget(accountConfig, hasPublicApps);
    targetAccountId = hasPublicApps ? accountConfig.parentAccountId : accountId;
  } else if (!targetAccountId && hasPublicApps) {
    checkIfAppDeveloperAccount(accountConfig);
  }

  if (!targetAccountId) {
    const {
      targetAccountId: selectedTargetAccountId,
      parentAccountId,
      createNestedAccount,
    } = await suggestRecommendedNestedAccount(
      accounts,
      accountConfig,
      hasPublicApps
    );

    targetAccountId = hasPublicApps ? parentAccountId : selectedTargetAccountId;
    createNewSandbox = isStandardAccount(accountConfig) && createNestedAccount;
    createNewDeveloperTestAccount =
      isAppDeveloperAccount(accountConfig) && createNestedAccount;
  }

  if (createNewSandbox) {
    targetAccountId = await createSandboxForLocalDev(
      accountId,
      accountConfig,
      env
    );
  }
  if (createNewDeveloperTestAccount) {
    await createDeveloperTestAccountForLocalDev(accountId, accountConfig, env);
    targetAccountId = accountId;
  }

  const projectExists = await ensureProjectExists(
    targetAccountId,
    projectConfig.name,
    {
      allowCreate: false,
      noLogs: true,
      withPolling: createNewSandbox,
    }
  );

  let deployedBuild;
  let isGithubLinked;

  if (projectExists) {
    const project = await fetchProject(targetAccountId, projectConfig.name);
    deployedBuild = project.deployedBuild;
    isGithubLinked =
      project.sourceIntegration &&
      project.sourceIntegration.source === 'GITHUB';
  }

  SpinniesManager.init();

  if (!projectExists) {
    await createNewProjectForLocalDev(
      projectConfig,
      targetAccountId,
      createNewSandbox
    );

    deployedBuild = await createInitialBuildForNewProject(
      projectConfig,
      projectDir,
      targetAccountId
    );
  }

  const LocalDev = new LocalDevManager({
    debug: options.debug,
    deployedBuild,
    projectConfig,
    projectDir,
    targetAccountId,
    isGithubLinked,
    components,
  });

  await LocalDev.start();

  handleExit(({ isSIGHUP }) => LocalDev.stop(!isSIGHUP));
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
  addTestingOptions(yargs, true);

  yargs.example([['$0 project dev', i18n(`${i18nKey}.examples.default`)]]);

  return yargs;
};
