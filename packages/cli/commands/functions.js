const {
  addConfigOptions,
  addAccountOptions,
  addOverwriteOptions,
} = require('../lib/commonOpts');
const list = require('./functions/list');
const deploy = require('./functions/deploy');
const test = require('./functions/test');

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
    .command(test)
    .demandCommand(1, '');

  return yargs;
};
