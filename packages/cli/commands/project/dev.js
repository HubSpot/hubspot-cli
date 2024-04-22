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

  // The account that the project must exist in
  let targetProjectAccountId = options.account ? accountId : null;
  // The account that we are locally testing against
  let targetTestingAccountId = targetProjectAccountId;

  let createNewSandbox = false;
  let createNewDeveloperTestAccount = false;

  if (!targetProjectAccountId && defaultAccountIsRecommendedType) {
    await confirmDefaultAccountIsTarget(accountConfig, hasPublicApps);
    targetProjectAccountId = hasPublicApps
      ? accountConfig.parentAccountId
      : accountId;
  } else if (!targetProjectAccountId && hasPublicApps) {
    checkIfAppDeveloperAccount(accountConfig);
  }

  if (!targetProjectAccountId) {
    const {
      targetAccountId,
      parentAccountId,
      createNestedAccount,
    } = await suggestRecommendedNestedAccount(
      accounts,
      accountConfig,
      hasPublicApps
    );

    targetProjectAccountId = hasPublicApps ? parentAccountId : targetAccountId;
    targetTestingAccountId = targetAccountId;

    createNewSandbox = isStandardAccount(accountConfig) && createNestedAccount;
    createNewDeveloperTestAccount =
      isAppDeveloperAccount(accountConfig) && createNestedAccount;
  }

  if (createNewSandbox) {
    targetProjectAccountId = await createSandboxForLocalDev(
      accountId,
      accountConfig,
      env
    );
    // We will be running our tests against this new sandbox account
    targetTestingAccountId = targetProjectAccountId;
  }
  if (createNewDeveloperTestAccount) {
    targetTestingAccountId = await createDeveloperTestAccountForLocalDev(
      accountId,
      accountConfig,
      env
    );
    targetProjectAccountId = accountId;
  }

  const projectExists = await ensureProjectExists(
    targetProjectAccountId,
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
    const project = await fetchProject(
      targetProjectAccountId,
      projectConfig.name
    );
    deployedBuild = project.deployedBuild;
    isGithubLinked =
      project.sourceIntegration &&
      project.sourceIntegration.source === 'GITHUB';
  }

  SpinniesManager.init();

  if (!projectExists) {
    await createNewProjectForLocalDev(
      projectConfig,
      targetProjectAccountId,
      createNewSandbox
    );

    deployedBuild = await createInitialBuildForNewProject(
      projectConfig,
      projectDir,
      targetProjectAccountId
    );
  }

  const LocalDev = new LocalDevManager({
    debug: options.debug,
    deployedBuild,
    projectConfig,
    projectDir,
    targetAccountId: targetTestingAccountId,
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
