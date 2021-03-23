const {
  addConfigOptions,
  addAccountOptions,
  addOverwriteOptions,
} = require('../lib/commonOpts');
const deploy = require('./projects/deploy');

exports.command = 'projects';
exports.describe = 'Commands for working with projects';

exports.builder = yargs => {
  addOverwriteOptions(yargs, true);
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs.command(deploy).demandCommand(1, '');

  return yargs;
};
