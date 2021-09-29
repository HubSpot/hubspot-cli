const {
  addConfigOptions,
  addAccountOptions,
  addOverwriteOptions,
} = require('../lib/commonOpts');
const deploy = require('./project/deploy');
const create = require('./project/create');
const upload = require('./project/upload');

exports.command = 'project';
exports.describe = false; //'Commands for working with projects';

exports.builder = yargs => {
  addOverwriteOptions(yargs, true);
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  // TODO: deploy must be updated
  yargs.command(deploy).demandCommand(1, '');
  yargs.command(create).demandCommand(0, '');
  yargs.command(upload).demandCommand(0, '');

  return yargs;
};
