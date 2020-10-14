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
const { updateSecret } = require('@hubspot/cms-lib/api/secrets');

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
const { secretValuePrompt } = require('../../lib/secretPrompt');

exports.command = 'update <name>';
exports.describe = 'Update an existing HubSpot secret';

exports.handler = async options => {
  const { name: secretName, config: configPath } = options;

  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
  const portalId = getPortalId(options);
  trackCommandUsage('secrets-update', {}, portalId);

  try {
    const { secretValue } = await secretValuePrompt();

    await updateSecret(portalId, secretName, secretValue);
    logger.log(
      `The secret "${secretName}" was updated in the HubSpot portal: ${portalId}`
    );
  } catch (e) {
    logger.error(`The secret "${secretName}" was not updated`);
    await logServerlessFunctionApiErrorInstance(
      portalId,
      e,
      new ApiErrorContext({
        request: 'update secret',
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
    describe: 'Name of the secret to be updated',
    type: 'string',
  });
  return yargs;
};
