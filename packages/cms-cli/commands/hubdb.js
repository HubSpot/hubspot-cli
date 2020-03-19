const path = require('path');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { getCwd } = require('@hubspot/cms-lib/path');
const {
  createHubDbTable,
  importHubDbTableRows,
  downloadHubDbTable,
  clearHubDbTable,
  deleteHubDbTable,
} = require('@hubspot/cms-lib/hubdb');

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

function configureHubDbCommand(program) {
  program
    .version(version)
    .description('Manage HubDB tables')
    .command('create <src>', 'create a HubDB table')
    .command('import <tableId> <src>', 'import a HubDB table')
    .command('fetch <tableId> <dest>', 'fetch a HubDB table')
    .command('delete <tableId>', 'delete a HubDB table')
    .command('clear <tableId>', 'clear all rows in a HubDB table');

  addLoggerOptions(program);
  addHelpUsageTracking(program);
}

function configureHubDbCreateCommand(program) {
  program
    .version(version)
    .description('Create HubDB tables')
    .arguments('<src>')
    .action(async (src, command = {}) => {
      setLogLevel(command);
      logDebugInfo(command);
      const { config: configPath } = command;
      loadConfig(configPath);
      checkAndWarnGitInclusion();

      if (!(validateConfig() && (await validatePortal(command)))) {
        process.exit(1);
      }
      const portalId = getPortalId(command);

      try {
        const table = await createHubDbTable(
          portalId,
          path.resolve(getCwd(), src)
        );
        logger.log(
          `The table ${table.tableId} was created in ${portalId} with ${table.rowCount} rows`
        );
      } catch (e) {
        logger.error(`Creating the table at "${src}" failed`);
        logger.error(e.message);
      }
    });

  addLoggerOptions(program);
  addPortalOptions(program);
  addConfigOptions(program);
}

function configureHubDbImportCommand(program) {
  program
    .version(version)
    .description('Import HubDB table rows')
    .arguments('<tableId> <src>')
    .action(async (tableId, src, command = {}) => {
      setLogLevel(command);
      logDebugInfo(command);
      const { config: configPath } = command;
      loadConfig(configPath);
      checkAndWarnGitInclusion();

      if (!(validateConfig() && (await validatePortal(command)))) {
        process.exit(1);
      }
      const portalId = getPortalId(command);

      try {
        const table = await importHubDbTableRows(
          portalId,
          tableId,
          path.resolve(getCwd(), src)
        );
        logger.log(
          `The table ${table.tableId} was updated in ${portalId} with ${table.rowCount} rows`
        );
      } catch (e) {
        logger.error(`Updating the table at "${src}" failed`);
        logger.error(e.message);
      }
    });

  addLoggerOptions(program);
  addPortalOptions(program);
  addConfigOptions(program);
}

function configureHubDbFetchCommand(program) {
  console.log('sdsd');
  program
    .version(version)
    .description('Fetch a HubDB table')
    .arguments('<tableId> <dest>')
    .action(async (tableId, dest, command = {}) => {
      setLogLevel(command);
      logDebugInfo(command);
      const { config: configPath } = command;
      loadConfig(configPath);
      checkAndWarnGitInclusion();

      if (!(validateConfig() && (await validatePortal(command)))) {
        process.exit(1);
      }
      const portalId = getPortalId(command);
      try {
        await downloadHubDbTable(
          portalId,
          tableId,
          path.resolve(getCwd(), dest)
        );
        logger.log(`Downloaded HubDB table ${tableId} to ${dest}`);
      } catch (e) {
        logger.error(e);
      }
    });

  addLoggerOptions(program);
  addPortalOptions(program);
  addConfigOptions(program);
}

function configureHubDbClearCommand(program) {
  program
    .version(version)
    .description('Delete all rows in a HubDB table')
    .arguments('<tableId>')
    .action(async (tableId, command = {}) => {
      setLogLevel(command);
      logDebugInfo(command);
      const { config: configPath } = command;
      loadConfig(configPath);
      checkAndWarnGitInclusion();

      if (!(validateConfig() && (await validatePortal(command)))) {
        process.exit(1);
      }
      const portalId = getPortalId(command);
      try {
        await clearHubDbTable(portalId, tableId);
        logger.log(`Delete rows in HubDB table ${tableId}`);
      } catch (e) {
        logger.error(e);
      }
    });

  addLoggerOptions(program);
  addPortalOptions(program);
  addConfigOptions(program);
}

function configureHubDbDeleteCommand(program) {
  program
    .version(version)
    .description('Delete a HubDB table')
    .arguments('<tableId>')
    .action(async (tableId, command = {}) => {
      setLogLevel(command);
      logDebugInfo(command);
      const { config: configPath } = command;
      loadConfig(configPath);
      checkAndWarnGitInclusion();

      if (!(validateConfig() && (await validatePortal(command)))) {
        process.exit(1);
      }
      const portalId = getPortalId(command);
      try {
        await deleteHubDbTable(portalId, tableId);
        logger.log(`Delete a HubDB table ${tableId}`);
      } catch (e) {
        logger.error(e);
      }
    });

  addLoggerOptions(program);
  addPortalOptions(program);
  addConfigOptions(program);
}

module.exports = {
  configureHubDbCommand,
  configureHubDbCreateCommand,
  configureHubDbFetchCommand,
  configureHubDbClearCommand,
  configureHubDbDeleteCommand,
  configureHubDbImportCommand,
};
