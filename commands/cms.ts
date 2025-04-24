// @ts-nocheck
const { i18n } = require('../lib/lang');
const {
  addConfigOptions,
  addAccountOptions,
  addGlobalOptions,
} = require('../lib/commonOpts');
const lighthouseScore = require('./cms/lighthouseScore');
const convertFields = require('./cms/convertFields');
const getReactModule = require('./cms/getReactModule');

exports.command = 'cms';
exports.describe = i18n(`commands.cms.describe`);

exports.builder = yargs => {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addGlobalOptions(yargs);

  yargs
    .command(lighthouseScore)
    .command(convertFields)
    .command(getReactModule)
    .demandCommand(1, '');

  return yargs;
};
