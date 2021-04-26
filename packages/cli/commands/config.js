const { addConfigOptions, addAccountOptions } = require('../lib/commonOpts');
const list = require('./config/list');
const set = require('./config/set');
const rename = require('./config/rename');

exports.command = 'config';
exports.describe = 'Commands for working with the config file';

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs
    .command({
      ...list,
      aliases: 'ls',
    })
    .command(set)
    .command(rename)
    .demandCommand(1, '');

  return yargs;
};
