const {
  addConfigOptions,
  addAccountOptions,
  addOverwriteOptions,
} = require('../lib/commonOpts');
const deploy = require('./projects/deploy');
const init = require('./projects/init');

exports.command = 'projects';
exports.describe = false; //'Commands for working with projects';

exports.builder = yargs => {
  addOverwriteOptions(yargs, true);
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs.command(deploy).demandCommand(1, '');
  yargs.command(init).demandCommand(0, '');

  return yargs;
};
