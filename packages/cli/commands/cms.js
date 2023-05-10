const { i18n } = require('../lib/lang');
const { addConfigOptions, addAccountOptions } = require('../lib/commonOpts');
const lighthouseScore = require('./cms/lighthouseScore');
const convertFields = require('./cms/convertFields');

const i18nKey = 'cli.commands.cms';

exports.command = 'cms';
exports.describe = i18n(`${i18nKey}.describe`);

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs
    .command(lighthouseScore)
    .command(convertFields)
    .demandCommand(1, '');

  return yargs;
};
