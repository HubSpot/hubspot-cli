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
const migrateApp = require('./project/migrateApp');
const cloneApp = require('./project/cloneApp');
const installDeps = require('./project/install');

const i18nKey = 'commands.project';

exports.command = 'project';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.builder = yargs => {
  addConfigOptions(yargs);
  addAccountOptions(yargs);

  yargs
    .command(create)
    .command(add)
    .command(watch)
    .command(dev)
    .command(upload)
    .command(deploy)
    .command(logs)
    .command(listBuilds)
    .command(download)
    .command(open)
    .command(migrateApp)
    .command(cloneApp)
    .command(installDeps)
    .demandCommand(1, '');

  return yargs;
};
