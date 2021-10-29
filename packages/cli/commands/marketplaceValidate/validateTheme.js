const fs = require('fs');
const path = require('path');

const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const { getCwd } = require('@hubspot/cli-lib/path');
const { logger } = require('@hubspot/cli-lib/logger');
const { walk } = require('@hubspot/cli-lib');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  setLogLevel,
  getAccountId,
} = require('../../lib/commonOpts');
const { logDebugInfo } = require('../../lib/debugInfo');
const { validateAccount } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const {
  logValidatorResults,
} = require('../../lib/validators/logValidatorResults');
const { applyValidators } = require('../../lib/validators/applyValidators');
const MARKETPLACE_VALIDATORS = require('../../lib/validators');
const { VALIDATION_RESULT } = require('../../lib/validators/constants');
const { EXIT_CODES } = require('../../lib/exitCodes');

exports.command = 'marketplace-validate <src>';
exports.describe = 'Validate a theme for the marketplace';

exports.handler = async options => {
  const { src, config: configPath } = options;
  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(EXIT_CODES.ERROR);
  }

  const accountId = getAccountId(options);
  const absoluteSrcPath = path.resolve(getCwd(), src);
  let stats;
  try {
    stats = fs.statSync(absoluteSrcPath);
    if (!stats.isDirectory()) {
      logger.error(`The path "${src}" is not a path to a folder`);
      return;
    }
  } catch (e) {
    logger.error(`The path "${src}" is not a path to a folder`);
    return;
  }

  if (!options.json) {
    logger.log(`Validating theme "${src}" \n`);
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
      describe: 'Output raw json data',
      type: 'boolean',
    },
  });
  yargs.positional('src', {
    describe:
      'Path to the local theme, relative to your current working directory.',
    type: 'string',
  });
  return yargs;
};
