// @ts-nocheck
const {
  addConfigOptions,
  addAccountOptions,
  addGlobalOptions,
} = require('../lib/commonOpts');
const list = require('./functions/list');
const deploy = require('./functions/deploy');
const server = require('./functions/server');
const { i18n } = require('../lib/lang');

const i18nKey = 'commands.functions';

exports.command = 'functions';
exports.describe = i18n(`${i18nKey}.describe`);

exports.builder = yargs => {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addGlobalOptions(yargs);

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
