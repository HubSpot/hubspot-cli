const { addConfigOptions, addPortalOptions } = require('../lib/commonOpts');
const schemaCommand = require('./customObject/schema');
const createCommand = require('./customObject/create');

exports.command = ['custom-object', 'custom', 'co'];
// This hides the command from --help until we are ready to release it
exports.describe = false; // 'Manage Custom Objects';
exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);

  yargs.command(schemaCommand).command(createCommand);

  return yargs;
};
