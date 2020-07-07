const path = require('path');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');
const { getCwd } = require('@hubspot/cms-lib/path');
const {
  createHubDbTable,
  downloadHubDbTable,
  clearHubDbTableRows,
} = require('@hubspot/cms-lib/hubdb');
const { publishTable, deleteTable } = require('@hubspot/cms-lib/api/hubdb');

const { validatePortal } = require('../lib/validation');
const {
  trackCommandUsage,
  addHelpUsageTracking,
} = require('../lib/usageTracking');
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
    .command('fetch <tableId> <dest>', 'fetch a HubDB table')
    .command('clear <tableId>', 'clear all rows in a HubDB table')
    .command('delete <tableId>', 'delete a HubDB table');

  addLoggerOptions(program);
  addHelpUsageTracking(program);
}

function configureHubDbCreateCommand(program) {
  program
    .version(version)
    .description('Create HubDB tables')
    .arguments('<src>')
    .action(async src => {
      setLogLevel(program);
      logDebugInfo(program);
      const { config: configPath } = program;
      loadConfig(configPath);
      checkAndWarnGitInclusion();

      if (!(validateConfig() && (await validatePortal(program)))) {
        process.exit(1);
      }
      const portalId = getPortalId(program);

      trackCommandUsage('hubdb-create', null, portalId);

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
        logErrorInstance(e);
      }
    });

  addLoggerOptions(program);
  addPortalOptions(program);
  addConfigOptions(program);
}

function configureHubDbFetchCommand(program) {
  program
    .version(version)
    .description('Fetch a HubDB table')
    .arguments('<tableId> [dest]')
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

      trackCommandUsage('hubdb-fetch', null, portalId);

      try {
        const { filePath } = await downloadHubDbTable(portalId, tableId, dest);

        logger.log(`Downloaded HubDB table ${tableId} to ${filePath}`);
      } catch (e) {
        logErrorInstance(e);
      }
    });

  addLoggerOptions(program);
  addPortalOptions(program);
  addConfigOptions(program);
}

function configureHubDbClearCommand(program) {
  program
    .version(version)
    .description('Clear all rows in a HubDB table')
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

      trackCommandUsage('hubdb-clear', null, portalId);

      try {
        const { deletedRowCount } = await clearHubDbTableRows(
          portalId,
          tableId
        );
        if (deletedRowCount > 0) {
          logger.log(
            `Removed ${deletedRowCount} rows from HubDB table ${tableId}`
          );
          const { rowCount } = await publishTable(portalId, tableId);
          logger.log(`HubDB table ${tableId} now contains ${rowCount} rows`);
        } else {
          logger.log(`HubDB table ${tableId} is already empty`);
        }
      } catch (e) {
        logErrorInstance(e);
      }
    });

  addLoggerOptions(program);
  addPortalOptions(program);
  addConfigOptions(program);
}

function configureHubDbDeleteCommand(program) {
  program
    .version(version)
    .description('Delete HubDB tables')
    .arguments('<tableId>')
    .action(async tableId => {
      setLogLevel(program);
      logDebugInfo(program);
      const { config: configPath } = program;
      loadConfig(configPath);
      checkAndWarnGitInclusion();

      if (!(validateConfig() && (await validatePortal(program)))) {
        process.exit(1);
      }
      const portalId = getPortalId(program);

      trackCommandUsage('hubdb-delete', null, portalId);

      try {
        await deleteTable(portalId, tableId);
        logger.log(`The table ${tableId} was deleted from ${portalId}`);
      } catch (e) {
        logger.error(`Deleting the table ${tableId} failed`);
        logErrorInstance(e);
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
};
