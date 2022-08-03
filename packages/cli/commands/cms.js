const { addConfigOptions, addAccountOptions } = require('../lib/commonOpts');
const lighthouseScore = require('./cms/lighthouseScore');

// const i18nKey = 'cli.commands.cms';

exports.command = 'cms';
exports.describe = false; // i18n(`${i18nKey}.describe`);

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs.command(lighthouseScore).demandCommand(1, '');

  return yargs;
};
