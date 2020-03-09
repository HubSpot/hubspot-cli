const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const {
  addSecret,
  deleteSecret,
  getSecrets,
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
    .command('add <secret-name> <secret-value>', 'add a HubSpot secret')
    .command('delete <secret-name>', 'delete a HubSpot secret')
    .command('list', 'list all HubSpot secrets');

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
      loadConfig(configPath);
      checkAndWarnGitInclusion();

      console.log(
        'Before validate',
        validateConfig(),
        await validatePortal(command)
      );

      if (!(validateConfig() && (await validatePortal(command)))) {
        process.exit(1);
      }
      const portalId = getPortalId(command);

      console.log('Portal ID: ', portalId);

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
      loadConfig(configPath);

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

function configureSecretsListCommand(program) {
  program
    .version(version)
    .description('List all HubSpot secrets')
    .action(async (options = {}) => {
      setLogLevel(options);
      logDebugInfo(options);
      const { config: configPath } = options;
      loadConfig(configPath);

      if (!(validateConfig() && (await validatePortal(options)))) {
        process.exit(1);
      }
      const portalId = getPortalId(options);

      try {
        const { results } = await getSecrets(portalId);
        logger.log(`Secrets for portal: ${portalId}:`);
        results.forEach(secret => logger.log(secret));
      } catch (e) {
        logger.error('Getting secrets failed');
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
  configureSecretsListCommand,
};
