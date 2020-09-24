const { addConfigOptions, addPortalOptions } = require('../lib/commonOpts');
const schemaCommand = require('./customObject/schema');
const createCommand = require('./customObject/create');

exports.command = ['custom-object', 'custom', 'co'];
exports.describe = 'Manage Custom Objects';
exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);

  yargs
    .command(schemaCommand)
    .command(createCommand)
    .demandCommand(1, '');

  return yargs;
};
