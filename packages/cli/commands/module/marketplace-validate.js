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
  logValidatorResults,
} = require('../../lib/validators/logValidatorResults');
const {
  applyRelativeValidators,
} = require('../../lib/validators/applyValidators');
const MARKETPLACE_VALIDATORS = require('../../lib/validators');
const { VALIDATION_RESULT } = require('../../lib/validators/constants');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.module.subcommands.marketplaceValidate';
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

exports.command = 'marketplace-validate <src>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { src } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  if (!options.json) {
    logger.log(
      i18n(`${i18nKey}.logs.validatingModule`, {
        path: src,
      })
    );
  }
  trackCommandUsage('validate', null, accountId);

  applyRelativeValidators(
    MARKETPLACE_VALIDATORS.module,
    src,
    src,
    accountId
  ).then(groupedResults => {
    logValidatorResults(groupedResults, { logAsJson: options.json });

    if (
      groupedResults
        .flat()
        .some(result => result.result === VALIDATION_RESULT.FATAL)
    ) {
      process.exit(EXIT_CODES.WARNING);
    }
  });
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.options({
    json: {
      describe: i18n(`${i18nKey}.options.json.describe`),
      type: 'boolean',
    },
  });
  yargs.positional('src', {
    describe: i18n(`${i18nKey}.positionals.src.describe`),
    type: 'string',
  });
  return yargs;
};
