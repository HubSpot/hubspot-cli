// @ts-nocheck
const { addGlobalOptions } = require('../lib/commonOpts');
const { i18n } = require('../lib/lang');
const { uiBetaTag } = require('../lib/ui');
const create = require('./sandbox/create');
const del = require('./sandbox/delete');

const i18nKey = 'commands.sandbox';

exports.command = ['sandbox', 'sandboxes'];
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.builder = yargs => {
  addGlobalOptions(yargs);

  yargs
    .command(create)
    .command(del)
    .demandCommand(1, '');

  return yargs;
};
