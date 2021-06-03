const { addConfigOptions, addAccountOptions } = require('../lib/commonOpts');
const set = require('./config/set');

exports.command = 'config';
exports.describe = 'Commands for working with the config file';

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs.command(set).demandCommand(1, '');

  return yargs;
};
