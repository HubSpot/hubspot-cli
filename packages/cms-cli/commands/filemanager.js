const {
  addConfigOptions,
  addPortalOptions,
  addOverwriteOptions,
} = require('../lib/commonOpts');
const upload = require('./filemanager/upload');
const fetch = require('./filemanager/fetch');
const { version } = require('../package.json');
const { addHelpUsageTracking } = require('../lib/usageTracking');

const COMMAND_NAME = 'filemanager';
const DESCRIPTION = 'Commands for working with the File Manager';

// Yargs Configuration
const command = `${COMMAND_NAME}`;
const describe = DESCRIPTION;
const builder = yargs => {
  addOverwriteOptions(yargs, true);
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);

  yargs
    .command(upload)
    .command(fetch)
    .demandCommand(1, '');

  return yargs;
};

const configureFileManagerCommanderCommand = commander => {
  commander
    .version(version)
    .description(DESCRIPTION)
    .command('fetch <src> [dest]', fetch.FETCH_DESCRIPTION)
    .command('upload <src> <dest>', upload.UPLOAD_DESCRIPTION);

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
