const fs = require('fs');
const path = require('path');

const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const { getCwd } = require('@hubspot/cli-lib/path');
const { logger } = require('@hubspot/cli-lib/logger');

const {
  addConfigOptions,
  addAccountOptions,
  addModeOptions,
  addUseEnvironmentOptions,
  setLogLevel,
  getAccountId,
  //getMode,
} = require('../../lib/commonOpts');
const { logDebugInfo } = require('../../lib/debugInfo');
const { validateAccount, validateMode } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const {
  logValidatorErrors,
} = require('../../lib/validators/logValidatorErrors');
const { applyValidators } = require('../../lib/validators/applyValidators');
const themeValidators = require('../../lib/validators/marketplaceValidators');

exports.command = 'marketplace-theme <src>';
exports.describe = 'Validate your theme for the marketplace';

exports.handler = async options => {
  const { src, config: configPath } = options;
  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  //TODO branden do I need this?
  if (
    !(
      validateConfig() &&
      (await validateAccount(options)) &&
      validateMode(options)
    )
  ) {
    process.exit(1);
  }

  const accountId = getAccountId(options);
  //TODO branden do I need this? const mode = getMode(options);
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

  logger.log(`Validating theme "${src}" \n`);
  trackCommandUsage('validate', {}, accountId);

  applyValidators(themeValidators, absoluteSrcPath).then(errors => {
    if (errors.length) {
      logValidatorErrors(errors);
    } else {
      logger.success(`Theme is valid \n`);
    }
  });
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addModeOptions(yargs, { write: true }, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.positional('src', {
    describe:
      'Path to the local theme, relative to your current working directory.',
    type: 'string',
  });
  return yargs;
};
