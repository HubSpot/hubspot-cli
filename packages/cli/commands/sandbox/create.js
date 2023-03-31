const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
  addTestingOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logger } = require('@hubspot/cli-lib/logger');
const Spinnies = require('spinnies');
const { createSandbox } = require('@hubspot/cli-lib/sandboxes');
const { loadAndValidateOptions } = require('../../lib/validation');
const { createSandboxPrompt } = require('../../lib/prompts/sandboxesPrompt');
const {
  getSandboxType,
  sandboxCreatePersonalAccessKeyFlow,
  getHasDevelopmentSandboxes,
  getDevSandboxLimit,
} = require('../../lib/sandboxes');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');
const {
  debugErrorAndContext,
} = require('@hubspot/cli-lib/errorHandlers/standardErrors');
const { ENVIRONMENTS } = require('@hubspot/cli-lib/lib/constants');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { getAccountConfig, getEnv } = require('@hubspot/cli-lib');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const {
  isMissingScopeError,
  isSpecifiedError,
} = require('@hubspot/cli-lib/errorHandlers/apiErrors');

const i18nKey = 'cli.commands.sandbox.subcommands.create';

exports.command = 'create [--name]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { name } = options;
  const accountId = getAccountId(options);
  const accountConfig = getAccountConfig(accountId);
  const env = options.qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD;
  const spinnies = new Spinnies({
    succeedColor: 'white',
  });

  trackCommandUsage('sandbox-create', null, accountId);

  if (
    accountConfig.sandboxAccountType &&
    accountConfig.sandboxAccountType !== null
  ) {
    trackCommandUsage('sandbox-create', { successful: false }, accountId);

    logger.error(
      i18n(`${i18nKey}.failure.creatingWithinSandbox`, {
        sandboxType: getSandboxType(accountConfig.sandboxAccountType),
      })
    );

    process.exit(EXIT_CODES.ERROR);
  }

  let namePrompt;

  logger.log(i18n(`${i18nKey}.sandboxLimitation`));
  logger.log('');

  if (!name) {
    namePrompt = await createSandboxPrompt();
  }

  const sandboxName = name || namePrompt.name;

  let result;

  try {
    spinnies.add('sandboxCreate', {
      text: i18n(`${i18nKey}.loading.add`, {
        sandboxName,
      }),
    });

    result = await createSandbox(accountId, sandboxName);

    logger.log('');
    spinnies.succeed('sandboxCreate', {
      text: i18n(`${i18nKey}.loading.succeed`, {
        name: result.name,
        sandboxHubId: result.sandboxHubId,
      }),
    });
  } catch (err) {
    debugErrorAndContext(err);

    trackCommandUsage('sandbox-create', { successful: false }, accountId);

    spinnies.fail('sandboxCreate', {
      text: i18n(`${i18nKey}.loading.fail`, {
        sandboxName,
      }),
    });

    if (isMissingScopeError(err)) {
      logger.error(
        i18n(`${i18nKey}.failure.scopes.message`, {
          accountName: accountConfig.name || accountId,
        })
      );
      const websiteOrigin = getHubSpotWebsiteOrigin(env);
      const url = `${websiteOrigin}/personal-access-key/${accountId}`;
      logger.info(
        i18n(`${i18nKey}.failure.scopes.instructions`, {
          accountName: accountConfig.name || accountId,
          url,
        })
      );
    } else if (
      isSpecifiedError(
        err,
        400,
        'VALIDATION_ERROR',
        'SandboxErrors.NUM_DEVELOPMENT_SANDBOXES_LIMIT_EXCEEDED_ERROR'
      ) &&
      err.error &&
      err.error.message
    ) {
      logger.log('');
      const devSandboxLimit = getDevSandboxLimit(err.error.message);
      const plural = devSandboxLimit !== 1;
      const hasDevelopmentSandboxes = getHasDevelopmentSandboxes(accountConfig);
      if (hasDevelopmentSandboxes) {
        logger.error(
          i18n(
            `${i18nKey}.failure.alreadyInConfig.${plural ? 'other' : 'one'}`,
            {
              accountName: accountConfig.name || accountId,
              limit: devSandboxLimit,
            }
          )
        );
      } else {
        const baseUrl = getHubSpotWebsiteOrigin(
          getEnv(accountId) === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
        );
        logger.error(
          i18n(`${i18nKey}.failure.limit.${plural ? 'other' : 'one'}`, {
            accountName: accountConfig.name || accountId,
            limit: devSandboxLimit,
            devSandboxesLink: `${baseUrl}/sandboxes-developer/${accountId}/development`,
          })
        );
      }
      logger.log('');
    } else {
      logErrorInstance(err);
    }
    process.exit(EXIT_CODES.ERROR);
  }
  try {
    await sandboxCreatePersonalAccessKeyFlow(
      env,
      result.sandboxHubId,
      result.name
    );
    process.exit(EXIT_CODES.SUCCESS);
  } catch (err) {
    logErrorInstance(err);
    process.exit(EXIT_CODES.ERROR);
  }
};

exports.builder = yargs => {
  yargs.option('name', {
    describe: i18n(`${i18nKey}.options.name.describe`),
    type: 'string',
  });

  yargs.example([
    [
      '$0 sandbox create --name=MySandboxAccount',
      i18n(`${i18nKey}.examples.default`),
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
  addTestingOptions(yargs, true);

  return yargs;
};
