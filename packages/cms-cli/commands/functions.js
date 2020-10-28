const {
  addConfigOptions,
  addPortalOptions,
  addOverwriteOptions,
} = require('../lib/commonOpts');
const list = require('./functions/list');
const build = require('./functions/build');

exports.command = 'functions';
exports.describe = 'Commands for working with functions';

exports.builder = yargs => {
  addOverwriteOptions(yargs, true);
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);

  yargs
    .command({
      ...list,
      aliases: 'ls',
    })
    .command(build)
    .demandCommand(1, '');

  return yargs;
};
