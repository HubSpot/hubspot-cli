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
const { deleteSecret } = require('@hubspot/cms-lib/api/secrets');
const { getScopeDataForFunctions } = require('@hubspot/cms-lib/lib/scopes');

const { validatePortal } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');

const {
  addConfigOptions,
  addPortalOptions,
  setLogLevel,
  getPortalId,
} = require('../../lib/commonOpts');
const { logDebugInfo } = require('../../lib/debugInfo');

exports.command = 'delete <name>';
exports.describe = 'Delete a HubSpot secret';

exports.handler = async options => {
  const { config: configPath, name: secretName } = options;

  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(configPath);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
  const portalId = getPortalId(options);
  trackCommandUsage('secrets-delete', {}, portalId);

  try {
    await deleteSecret(portalId, secretName);
    logger.log(
      `The secret "${secretName}" was deleted from the HubSpot portal: ${portalId}`
    );
  } catch (e) {
    logger.error(`The secret "${secretName}" was not deleted`);
    logServerlessFunctionApiErrorInstance(
      e,
      await getScopeDataForFunctions(portalId),
      new ApiErrorContext({
        request: 'delete a secret',
        portalId,
      })
    );
  }
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);
  yargs.positional('name', {
    describe: 'Name of the secret',
    type: 'string',
  });
  return yargs;
};
