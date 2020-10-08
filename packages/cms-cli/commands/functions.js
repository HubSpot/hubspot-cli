const {
  addConfigOptions,
  addPortalOptions,
  addOverwriteOptions,
} = require('../lib/commonOpts');
const list = require('./functions/list');

exports.command = 'functions';
exports.describe = 'Commands for working with functions';

exports.builder = yargs => {
  addOverwriteOptions(yargs, true);
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);

  yargs.command(list).demandCommand(1, '');

  return yargs;
};
