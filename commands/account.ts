// @ts-nocheck
const { addGlobalOptions } = require('../lib/commonOpts');
const { i18n } = require('../lib/lang');
const list = require('./account/list');
const rename = require('./account/rename');
const use = require('./account/use');
const info = require('./account/info');
const remove = require('./account/remove');
const clean = require('./account/clean');
const createOverride = require('./account/createOverride');

const i18nKey = 'commands.account';

exports.command = ['account', 'accounts'];
exports.describe = i18n(`${i18nKey}.describe`);

exports.builder = yargs => {
  addGlobalOptions(yargs);

  yargs
    .command(list)
    .command(rename)
    .command(use)
    .command(info)
    .command(remove)
    .command(clean)
    .command(createOverride)
    .demandCommand(1, '');

  return yargs;
};
