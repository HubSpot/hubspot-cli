const Spinnies = require('spinnies');
const chalk = require('chalk');

const { logger } = require('@hubspot/cli-lib/logger');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  getAccountId,
} = require('../../lib/commonOpts');
const { loadAndValidateOptions } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const {
  requestValidation,
  getValidationStatus,
  getValidationResults,
} = require('@hubspot/cli-lib/api/marketplaceValidation');

const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.theme.subcommands.marketplaceValidate';
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

exports.command = 'marketplace-validate <src>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { src } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('validate', null, accountId);

  const spinnies = new Spinnies();

  spinnies.add('marketplaceValidation', {
    text: i18n(`${i18nKey}.logs.validatingTheme`, {
      path: src,
    }),
  });

  // Kick off validation
  let requestResult;
  const assetType = 'THEME';
  const requestGroup = 'EXTERNAL_DEVELOPER';
  try {
    requestResult = await requestValidation(accountId, {
      path: src,
      assetType,
      requestGroup,
    });
  } catch (err) {
    logger.debug(err);
    process.exit(EXIT_CODES.ERROR);
  }

  // Poll till validation is finished
  try {
    const checkValidationStatus = async () => {
      const validationStatus = await getValidationStatus(accountId, {
        validationId: requestResult,
      });

      if (validationStatus === 'REQUESTED') {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await checkValidationStatus();
      }
    };

    await checkValidationStatus();

    spinnies.remove('marketplaceValidation');
  } catch (err) {
    logger.debug(err);
    process.exit(EXIT_CODES.ERROR);
  }

  // Fetch the validation results
  let validationResults;
  try {
    validationResults = await getValidationResults(accountId, {
      validationId: requestResult,
    });
  } catch (err) {
    logger.debug(err);
    process.exit(EXIT_CODES.ERROR);
  }

  if (validationResults.errors.length) {
    const { errors } = validationResults;

    errors.forEach(err => {
      logger.error(`${err.context}`);

      if (err.failureReasonType === 'DOWNLOAD_EMPTY') {
        logger.log(
          i18n(`${i18nKey}.errors.invalidPath`, {
            path: src,
          })
        );
      }
    });
    process.exit(EXIT_CODES.ERROR);
  }

  const displayResults = checks => {
    if (checks) {
      const { status, results } = checks;

      if (status === 'FAIL') {
        const failedValidations = results.filter(
          test => test.status === 'FAIL'
        );
        failedValidations.forEach(val => {
          logger.error(`${val.message}`);
        });
      }

      if (status === 'PASS') {
        logger.success(i18n(`${i18nKey}.results.noErrors`));
      }
    }
    return null;
  };

  logger.log(chalk.bold(i18n(`${i18nKey}.results.required`)));
  displayResults(validationResults.results['REQUIRED']);
  logger.log();
  logger.log(chalk.bold(i18n(`${i18nKey}.results.recommended`)));
  displayResults(validationResults.results['RECOMMENDED']);
  logger.log();

  process.exit();
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.positional('src', {
    describe: i18n(`${i18nKey}.positionals.src.describe`),
    type: 'string',
  });
  return yargs;
};
