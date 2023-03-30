const { addConfigOptions, addAccountOptions } = require('../lib/commonOpts');
const deploy = require('./project/deploy');
const create = require('./project/create');
const upload = require('./project/upload');
const listBuilds = require('./project/listBuilds');
const logs = require('./project/logs');
const watch = require('./project/watch');
const download = require('./project/download');
const open = require('./project/open');
const components = require('./project/components');

exports.command = 'project';
exports.describe = false; //'Commands for working with projects';

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  // TODO: deploy must be updated
  yargs.command(deploy).demandCommand(1, '');
  yargs.command(create).demandCommand(0, '');
  yargs.command(upload).demandCommand(0, '');
  yargs.command(watch).demandCommand(0, '');
  yargs.command(listBuilds).demandCommand(0, '');
  yargs.command(logs).demandCommand(1, '');
  yargs.command(download).demandCommand(0, '');
  yargs.command(open).demandCommand(0, '');
  yargs.command(components).demandCommand(0, '');

  return yargs;
};
