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
const validators = require('../../lib/validators');
const { VALIDATION_RESULT } = require('../../lib/validators/constants');

exports.command = 'theme <src>';
exports.describe = 'Validate a theme';

exports.handler = async options => {
  const { src, config: configPath } = options;
  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
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

  const themeValidators = options.marketplace
    ? validators.marketplaceValidators.theme
    : validators.hubspotValidators.theme;

  const themeFiles = await walk(absoluteSrcPath);

  applyValidators(themeValidators, absoluteSrcPath, themeFiles).then(
    results => {
      logValidatorResults(results, { logAsJson: options.json });

      if (results.some(result => result.result === VALIDATION_RESULT.FATAL)) {
        process.exit(1);
      }
    }
  );
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  yargs.options({
    marketplace: {
      describe: 'Validate theme for the marketplace',
      type: 'boolean',
    },
  });
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
