const fs = require('fs');
const path = require('path');

const { getCwd } = require('@hubspot/cli-lib/path');
const { logger } = require('@hubspot/cli-lib/logger');
const { walk } = require('@hubspot/cli-lib');

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
const { applyValidators } = require('../../lib/validators/applyValidators');
const MARKETPLACE_VALIDATORS = require('../../lib/validators');
const { VALIDATION_RESULT } = require('../../lib/validators/constants');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.theme.subcommands.marketplaceValidate';

exports.command = 'marketplace-validate <src>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { src } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);
  const absoluteSrcPath = path.resolve(getCwd(), src);
  let stats;
  try {
    stats = fs.statSync(absoluteSrcPath);
    if (!stats.isDirectory()) {
      logger.error(
        i18n(`${i18nKey}.errors.invalidPath`, {
          path: src,
        })
      );
      return;
    }
  } catch (e) {
    logger.error(
      i18n(`${i18nKey}.errors.invalidPath`, {
        path: src,
      })
    );
    return;
  }

  if (!options.json) {
    logger.log(
      i18n(`${i18nKey}.logs.validatingTheme`, {
        path: src,
      })
    );
  }
  trackCommandUsage('validate', {}, accountId);

  const themeFiles = await walk(absoluteSrcPath);

  applyValidators(
    MARKETPLACE_VALIDATORS.theme,
    absoluteSrcPath,
    themeFiles,
    accountId
  ).then(groupedResults => {
    logValidatorResults(groupedResults, { logAsJson: options.json });

    if (
      groupedResults
        .flat()
        .some(result => result.result === VALIDATION_RESULT.FATAL)
    ) {
      process.exit(2);
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
