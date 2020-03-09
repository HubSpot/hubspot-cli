const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { addSecret, deleteSecret } = require('@hubspot/cms-lib/api/secrets');

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
    .command('add <secret-name> <secret-value>', 'add a HubSpot secret')
    .command('delete <secret-name>', 'delete a HubSpot secret');

  addLoggerOptions(program);
  addHelpUsageTracking(program);
}

function configureSecretsAddCommand(program) {
  program
    .version(version)
    .description('Add a HubSpot secret')
    .arguments('<secret-name> <secret-value>')
    .action(async (secretName, secretValue, command = {}) => {
      setLogLevel(command);
      logDebugInfo(command);
      const { config: configPath } = command;
      loadConfig(configPath, {
        allowEnvironmentVariableConfig: true,
      });
      checkAndWarnGitInclusion();

      if (!(validateConfig() && (await validatePortal(command)))) {
        process.exit(1);
      }
      const portalId = getPortalId(command);

      try {
        await addSecret(portalId, secretName, secretValue);
        logger.log(
          `The secret "${secretName}" was added to the HubSpot portal: ${portalId}`
        );
      } catch (e) {
        logger.error(`Adding secret "${secretName}" failed`);
        logger.error(e.message);
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
    .arguments('<secret-name>')
    .action(async (secretName, command = {}) => {
      setLogLevel(command);
      logDebugInfo(command);
      const { config: configPath } = command;
      loadConfig(configPath, {
        allowEnvironmentVariableConfig: true,
      });

      if (!(validateConfig() && (await validatePortal(command)))) {
        process.exit(1);
      }
      const portalId = getPortalId(command);

      try {
        await deleteSecret(portalId, secretName);
        logger.log(
          `The secret "${secretName}" was deleted from the HubSpot portal: ${portalId}`
        );
      } catch (e) {
        logger.error(`Deleting secret "${secretName}" failed`);
        logger.error(e.message);
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
};
