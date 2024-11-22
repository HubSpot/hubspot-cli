// @ts-nocheck
const list = require('./function/list');
const deploy = require('./function/deploy');
const server = require('./function/server');
const { i18n } = require('../lib/lang');

const i18nKey = 'commands.function';

exports.command = ['function', 'functions'];
exports.describe = i18n(`${i18nKey}.describe`);

exports.builder = yargs => {
  yargs
    .command(list)
    .command(deploy)
    .command(server)
    .demandCommand(1, '');

  return yargs;
};
