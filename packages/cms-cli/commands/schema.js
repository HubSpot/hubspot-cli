const { addConfigOptions, addPortalOptions } = require('../lib/commonOpts');
const createCommand = require('./schema/create');

exports.command = 'schema';
// This hides the command from --help until we are ready to release it
exports.describe = false; //'Manage Custom Schema';
exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);

  yargs.command(createCommand);

  return yargs;
};
