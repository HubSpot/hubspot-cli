const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const {
  logServerlessFunctionApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cms-lib/errorHandlers');
const { fetchSecrets } = require('@hubspot/cms-lib/api/secrets');

const { validateAccount } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  setLogLevel,
  getAccountId,
} = require('../../lib/commonOpts');
const { logDebugInfo } = require('../../lib/debugInfo');

exports.command = 'list';
exports.describe = 'List all HubSpot secrets';

exports.handler = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
  const accountId = getAccountId(options);
  trackCommandUsage('secrets-list', {}, accountId);

  try {
    const { results } = await fetchSecrets(accountId);
    const groupLabel = `Secrets for account ${accountId}:`;
    logger.group(groupLabel);
    results.forEach(secret => logger.log(secret));
    logger.groupEnd(groupLabel);
  } catch (e) {
    logger.error('The secrets could not be listed');
    await logServerlessFunctionApiErrorInstance(
      accountId,
      e,
      new ApiErrorContext({
        request: 'add secret',
        accountId,
      })
    );
  }
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
  return yargs;
};
