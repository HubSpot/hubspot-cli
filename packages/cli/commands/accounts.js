const { addConfigOptions, addAccountOptions } = require('../lib/commonOpts');
const list = require('./accounts/list');
const rename = require('./accounts/rename');

exports.command = 'accounts';
exports.describe = 'Commands for working with accounts';

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs
    .command({
      ...list,
      aliases: 'ls',
    })
    .command(rename)
    .demandCommand(1, '');

  return yargs;
};
