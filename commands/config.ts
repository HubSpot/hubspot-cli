// @ts-nocheck
const { addConfigOptions, addGlobalOptions } = require('../lib/commonOpts');
const { i18n } = require('../lib/lang');
const set = require('./config/set');

exports.command = 'config';
exports.describe = i18n('commands.config.describe');

exports.builder = yargs => {
  addConfigOptions(yargs);
  addGlobalOptions(yargs);

  yargs.command(set).demandCommand(1, '');

  return yargs;
};
