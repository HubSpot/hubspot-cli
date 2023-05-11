const { addConfigOptions, addAccountOptions } = require('../lib/commonOpts');
const list = require('./functions/list');
const deploy = require('./functions/deploy');
const server = require('./functions/server');
const { i18n } = require('../lib/lang');

const i18nKey = 'cli.commands.functions';

exports.command = 'functions';
exports.describe = i18n(`${i18nKey}.describe`);

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs
    .command({
      ...list,
      aliases: 'ls',
    })
    .command(deploy)
    .command(server)
    .demandCommand(1, '');

  return yargs;
};
