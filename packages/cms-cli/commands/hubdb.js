const { addHelpUsageTracking } = require('../lib/usageTracking');
const { addLoggerOptions } = require('../lib/commonOpts');
const { addConfigOptions, addPortalOptions } = require('../lib/commonOpts');
const createCommand = require('./hubdb/create');
const fetchCommand = require('./hubdb/fetch');
const deleteCommand = require('./hubdb/delete');
const clearCommand = require('./hubdb/clear');

const { version } = require('../package.json');

const COMMAND_NAME = 'hubdb';
const DESCRIPTION = 'Manage HubDB tables';

// Yargs Configuration
const command = `${COMMAND_NAME}`;
const describe = DESCRIPTION;
const builder = yargs => {
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);

  yargs
    .command(clearCommand)
    .command(createCommand)
    .command(fetchCommand)
    .command(deleteCommand);

  return yargs;
};

// Commander Configuration
const configureCommanderHubDbCommand = commander => {
  commander
    .version(version)
    .description(DESCRIPTION)
    .command('create <src>', createCommand.CREATE_DESCRIPTION)
    .command('fetch <tableId> <dest>', fetchCommand.FETCH_DESCRIPTION)
    .command('clear <tableId>', clearCommand.CLEAR_DESCRIPTION)
    .command('delete <tableId>', deleteCommand.DELETE_DESCRIPTION);

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
