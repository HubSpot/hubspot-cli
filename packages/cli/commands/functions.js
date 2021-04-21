const { addConfigOptions, addAccountOptions } = require('../lib/commonOpts');
const list = require('./functions/list');
const deploy = require('./functions/deploy');
const server = require('./functions/server');

exports.command = 'functions';
exports.describe = 'Commands for working with functions';

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs
    .command({
      ...list,
      aliases: 'ls',
    })
    .command(deploy)
    .command(server)
    .demandCommand(1, '');

  return yargs;
};
