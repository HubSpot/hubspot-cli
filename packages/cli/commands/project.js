const { addConfigOptions, addAccountOptions } = require('../lib/commonOpts');
const { i18n } = require('../lib/lang');
const { uiBetaTag } = require('../lib/ui');
const deploy = require('./project/deploy');
const create = require('./project/create');
const upload = require('./project/upload');
const listBuilds = require('./project/listBuilds');
const logs = require('./project/logs');
const watch = require('./project/watch');
const download = require('./project/download');
const open = require('./project/open');
const dev = require('./project/dev');
const add = require('./project/add');

const i18nKey = 'cli.commands.project';

exports.command = 'project';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  // TODO: deploy must be updated
  yargs.command(create).demandCommand(0, '');
  yargs.command(add).demandCommand(0, '');
  yargs.command(watch).demandCommand(0, '');
  yargs.command(dev).demandCommand(0, '');
  yargs.command(upload).demandCommand(0, '');
  yargs.command(deploy).demandCommand(1, '');
  yargs.command(logs).demandCommand(1, '');
  yargs.command(listBuilds).demandCommand(0, '');
  yargs.command(download).demandCommand(0, '');
  yargs.command(open).demandCommand(0, '');

  return yargs;
};
