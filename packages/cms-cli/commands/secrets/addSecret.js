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
const { addSecret } = require('@hubspot/cms-lib/api/secrets');

const { validatePortal } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');

const {
  addConfigOptions,
  addPortalOptions,
  addUseEnvironmentOptions,
  setLogLevel,
  getPortalId,
} = require('../../lib/commonOpts');
const { logDebugInfo } = require('../../lib/debugInfo');

exports.command = 'add <name> <value>';
exports.describe = 'Add a HubSpot secret';

exports.handler = async options => {
  const { config: configPath, name: secretName, value: secretValue } = options;

  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
  const portalId = getPortalId(options);
  trackCommandUsage('secrets-add', {}, portalId);

  try {
    await addSecret(portalId, secretName, secretValue);
    logger.log(
      `The secret "${secretName}" was added to the HubSpot portal: ${portalId}`
    );
  } catch (e) {
    logger.error(`The secret "${secretName}" was not added`);
    await logServerlessFunctionApiErrorInstance(
      portalId,
      e,
      new ApiErrorContext({
        request: 'add secret',
        portalId,
      })
    );
  }
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
  yargs.positional('name', {
    describe: 'Name of the secret',
    type: 'string',
  });
  yargs.positional('value', {
    describe: 'The secret to be stored such as an API key',
    type: 'string',
  });
  return yargs;
};
