const { i18n } = require('../lib/lang');
const { addConfigOptions, addAccountOptions } = require('../lib/commonOpts');
const lighthouseScore = require('./cms/lighthouseScore');
const convertFields = require('./cms/convertFields');
const reactModules = require('./cms/reactModules');

const i18nKey = 'commands.cms';

exports.command = 'cms';
exports.describe = i18n(`${i18nKey}.describe`);

exports.builder = yargs => {
  addConfigOptions(yargs);
  addAccountOptions(yargs);

  yargs
    .command(lighthouseScore)
    .command(convertFields)
    .command(reactModules)
    .demandCommand(1, '');

  return yargs;
};
