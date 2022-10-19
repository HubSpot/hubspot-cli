const Spinnies = require('spinnies');

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
    text: 'TODO Marketplace validation is underway',
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
    logger.error('TODO Failed to get validation results');
    process.exit(EXIT_CODES.ERROR);
  }

  const requiredValidations = validationResults.results['REQUIRED'];
  const recommendedValidations = validationResults.results['RECOMMENDED'];

  const displayResults = checks => {
    const { status, results } = checks;

    logger.log(`${status}`);
    if (status === 'FAIL') {
      const failedValidations = results.filter(test => test.status === 'FAIL');

      logger.log('Failed checks:');
      failedValidations.forEach(val => {
        logger.log(`${val.message}`);
      });
    }
  };

  logger.log('Required validations:');
  displayResults(requiredValidations);
  logger.log();
  logger.log('Recommended validations:');
  displayResults(recommendedValidations);
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
