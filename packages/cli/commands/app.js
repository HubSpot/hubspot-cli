const { addConfigOptions, addAccountOptions } = require('../lib/commonOpts');
const deploy = require('./app/deploy');

exports.command = 'app';
exports.describe = false;

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs.command(deploy).demandCommand(1, '');

  return yargs;
};
