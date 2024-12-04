// @ts-nocheck
const { i18n } = require('../lib/lang');
const {
  addConfigOptions,
  addAccountOptions,
  addGlobalOptions,
} = require('../lib/commonOpts');
const convertFields = require('./cms/convertFields');
const getReactModule = require('./cms/getReactModule');

const i18nKey = 'commands.cms';

exports.command = 'cms';
exports.describe = i18n(`${i18nKey}.describe`);

exports.builder = yargs => {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addGlobalOptions(yargs);

  yargs
    .command(convertFields)
    .command(getReactModule)
    .demandCommand(1, '');

  return yargs;
};
