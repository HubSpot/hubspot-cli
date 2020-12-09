const {
  addConfigOptions,
  addAccountOptions,
  addOverwriteOptions,
} = require('../lib/commonOpts');
const list = require('./functions/list');
const deploy = require('./functions/deploy');

exports.command = 'functions';
exports.describe = 'Commands for working with functions';

exports.builder = yargs => {
  addOverwriteOptions(yargs, true);
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs
    .command({
      ...list,
      aliases: 'ls',
    })
    .command(deploy)
    .demandCommand(1, '');

  return yargs;
};
