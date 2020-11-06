const {
  addConfigOptions,
  addAccountOptions,
  addOverwriteOptions,
} = require('../lib/commonOpts');
const list = require('./functions/list');

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
    .demandCommand(1, '');

  return yargs;
};
