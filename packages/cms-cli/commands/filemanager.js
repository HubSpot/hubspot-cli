const { addLoggerOptions } = require('../lib/commonOpts');
const { configureUpload, UPLOAD_DESCRIPTION } = require('./filemanager/upload');
const { configureFetch, FETCH_DESCRIPTION } = require('./filemanager/fetch');
const { version } = require('../package.json');
const { addHelpUsageTracking } = require('../lib/usageTracking');

const COMMAND_NAME = 'filemanager';
const DESCRIPTION = 'Commands for working with the File Manager';

// Yargs Configuration
const command = `${COMMAND_NAME}`;
const describe = DESCRIPTION;
const builder = yargs => {
  addLoggerOptions(yargs, true);

  configureFetch(yargs);
  configureUpload(yargs);

  return yargs;
};

const configureFileManagerCommanderCommand = commander => {
  commander
    .version(version)
    .description(DESCRIPTION)
    .command('fetch <src> [dest]', FETCH_DESCRIPTION)
    .command('upload <src> <dest>', UPLOAD_DESCRIPTION);

  addHelpUsageTracking(commander);
};

module.exports = {
  // Yargs
  command,
  describe,
  builder,
  // Commander
  configureFileManagerCommanderCommand,
};
