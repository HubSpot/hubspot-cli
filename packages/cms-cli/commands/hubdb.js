const { addHelpUsageTracking } = require('../lib/usageTracking');
const { addLoggerOptions } = require('../lib/commonOpts');
const { configureCreate, CREATE_DESCRIPTION } = require('./hubdb/create');
const { configureFetch, FETCH_DESCRIPTION } = require('./hubdb/fetch');
const { configureClear, CLEAR_DESCRIPTION } = require('./hubdb/clear');
const { configureDelete, DELETE_DESCRIPTION } = require('./hubdb/delete');

const { version } = require('../package.json');

const COMMAND_NAME = 'hubdb';
const DESCRIPTION = 'Manage HubDB tables';

// Yargs Configuration
const command = `${COMMAND_NAME}`;
const describe = DESCRIPTION;
const builder = yargs => {
  addLoggerOptions(yargs, true);

  configureCreate(yargs);
  configureFetch(yargs);
  configureClear(yargs);
  configureDelete(yargs);

  return yargs;
};

// Commander Configuration
const configureCommanderHubDbCommand = commander => {
  commander
    .version(version)
    .description(DESCRIPTION)
    .command('create <src>', CREATE_DESCRIPTION)
    .command('fetch <tableId> <dest>', FETCH_DESCRIPTION)
    .command('clear <tableId>', CLEAR_DESCRIPTION)
    .command('delete <tableId>', DELETE_DESCRIPTION);

  addLoggerOptions(commander);
  addHelpUsageTracking(commander);
};

module.exports = {
  // Yargs
  command,
  describe,
  builder,
  // Commander
  configureCommanderHubDbCommand,
};
