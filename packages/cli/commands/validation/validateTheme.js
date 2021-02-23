const fs = require('fs');
const path = require('path');

const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const { getCwd } = require('@hubspot/cli-lib/path');
const { logger } = require('@hubspot/cli-lib/logger');

const themeValidators = require('./themeValidators');
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
const { logValidationErrors } = require('./validationErrorUtils');

exports.command = 'validate-theme <src>';
exports.describe = 'Validate your theme';

function getValidationErrors(absoluteSrcPath) {
  return Promise.all(
    themeValidators.map(validator => validator.validate(absoluteSrcPath))
  ).then(errorsGroupedByValidatorType =>
    errorsGroupedByValidatorType.reduce((errorGroup, acc) => {
      return [...acc, ...errorGroup];
    }, [])
  );
}

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

  logger.log(`Validating theme at: "${src}"`);
  trackCommandUsage('validate', {}, accountId);

  getValidationErrors(absoluteSrcPath).then(errors => {
    if (errors.length) {
      logValidationErrors(errors);
    } else {
      logger.success(`Theme is valid`);
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
