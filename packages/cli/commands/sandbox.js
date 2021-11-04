const { addConfigOptions, addAccountOptions } = require('../lib/commonOpts');
const create = require('./sandbox/create');

exports.command = 'sandbox';
exports.describe = false; //'Commands for working with sandboxes';

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs.command(create).demandCommand(1, '');

  return yargs;
};
