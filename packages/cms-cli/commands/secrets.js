const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cms-lib/errorHandlers');
const {
  addSecret,
  deleteSecret,
  fetchSecrets,
} = require('@hubspot/cms-lib/api/secrets');

const { validatePortal } = require('../lib/validation');
const { addHelpUsageTracking } = require('../lib/usageTracking');
const { version } = require('../package.json');

const {
  addConfigOptions,
  addLoggerOptions,
  addPortalOptions,
  setLogLevel,
  getPortalId,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');

function configureSecretsCommand(program) {
  program
    .version(version)
    .description('Manage secrets')
    .command('add <name> <value>', 'add a HubSpot secret')
    .command('delete <name>', 'delete a HubSpot secret')
    .command('list', 'list all HubSpot secrets');

  addLoggerOptions(program);
  addHelpUsageTracking(program);
}

function configureSecretsAddCommand(program) {
  program
    .version(version)
    .description('Add a HubSpot secret')
    .arguments('<name> <value>')
    .action(async (secretName, secretValue) => {
      setLogLevel(program);
      logDebugInfo(program);
      const { config: configPath } = program;
      loadConfig(configPath);
      checkAndWarnGitInclusion();

      if (!(validateConfig() && (await validatePortal(program)))) {
        process.exit(1);
      }
      const portalId = getPortalId(program);

      try {
        await addSecret(portalId, secretName, secretValue);
        logger.log(
          `The secret "${secretName}" was added to the HubSpot portal: ${portalId}`
        );
      } catch (e) {
        logger.error(`The secret "${secretName}" was not added`);
        logApiErrorInstance(
          e,
          new ApiErrorContext({
            request: 'add secret',
            portalId,
          })
        );
      }
    });

  addLoggerOptions(program);
  addPortalOptions(program);
  addConfigOptions(program);
}

function configureSecretsDeleteCommand(program) {
  program
    .version(version)
    .description('Delete a HubSpot secret')
    .arguments('<name>')
    .action(async secretName => {
      setLogLevel(program);
      logDebugInfo(program);
      const { config: configPath } = program;
      loadConfig(configPath);

      if (!(validateConfig() && (await validatePortal(program)))) {
        process.exit(1);
      }
      const portalId = getPortalId(program);

      try {
        await deleteSecret(portalId, secretName);
        logger.log(
          `The secret "${secretName}" was deleted from the HubSpot portal: ${portalId}`
        );
      } catch (e) {
        logger.error(`The secret "${secretName}" was not deleted`);
        logApiErrorInstance(
          e,
          new ApiErrorContext({
            request: `delete a secret`,
            portalId,
          })
        );
      }
    });

  addLoggerOptions(program);
  addPortalOptions(program);
  addConfigOptions(program);
}

function configureSecretsListCommand(program) {
  program
    .version(version)
    .description('List all HubSpot secrets')
    .action(async () => {
      setLogLevel(program);
      logDebugInfo(program);
      const { config: configPath } = program;
      loadConfig(configPath);

      if (!(validateConfig() && (await validatePortal(program)))) {
        process.exit(1);
      }
      const portalId = getPortalId(program);

      try {
        const { results } = await fetchSecrets(portalId);
        const groupLabel = `Secrets for portal ${portalId}:`;
        logger.group(groupLabel);
        results.forEach(secret => logger.log(secret));
        logger.groupEnd(groupLabel);
      } catch (e) {
        logger.error('The secrets could not be listed');
        logApiErrorInstance(
          e,
          new ApiErrorContext({
            request: 'get secrets',
            portalId,
          })
        );
      }
    });

  addLoggerOptions(program);
  addPortalOptions(program);
  addConfigOptions(program);
}

module.exports = {
  configureSecretsCommand,
  configureSecretsAddCommand,
  configureSecretsDeleteCommand,
  configureSecretsListCommand,
};
