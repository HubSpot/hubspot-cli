#!/usr/bin/env node
const path = require('path');
const { loadConfig } = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { getCwd } = require('@hubspot/cms-lib/path');
const { createHubDbTable } = require('@hubspot/cms-lib/hubdb');

const { validateConfig, validatePortal } = require('../lib/validation');
const { version } = require('../package.json');

const {
  addConfigOptions,
  addLoggerOptions,
  addPortalOptions,
  setLogLevel,
  getPortalId,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');

function configureHubDbCommand(program, bin) {
  program
    .version(version)
    .description('Manage HubDB tables')
    .arguments('<subcommand> <src>')
    .action(async (subcommand, src, command = {}) => {
      setLogLevel(command);
      logDebugInfo(command);
      const { config: configPath } = command;
      loadConfig(configPath);

      if (!(validateConfig() && (await validatePortal(command)))) {
        process.exit(1);
      }
      const portalId = getPortalId(command);

      switch (subcommand) {
        case 'create':
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
          break;
        default:
          logger.error(`The command "${bin} hubdb ${subcommand}" is not valid`);
      }
    });

  addLoggerOptions(program);
  addPortalOptions(program);
  addConfigOptions(program);
}

module.exports = {
  configureHubDbCommand,
};
