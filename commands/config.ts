// @ts-nocheck
const { addConfigOptions, addGlobalOptions } = require('../lib/commonOpts');
const { i18n } = require('../lib/lang');
const set = require('./config/set');

const i18nKey = 'commands.config';

exports.command = 'config';
exports.describe = i18n(`${i18nKey}.describe`);

exports.builder = yargs => {
  addConfigOptions(yargs);
  addGlobalOptions(yargs);

  yargs.command(set).demandCommand(1, '');

  return yargs;
};
