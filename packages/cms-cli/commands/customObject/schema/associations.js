const {
  addConfigOptions,
  addPortalOptions,
  addOverwriteOptions,
} = require('../lib/commonOpts');
const create = require('./associations/create');
const remove = require('./associations/remove');
const list = require('./associations/list');

exports.command = 'associations';
exports.describe = 'Manage object associations with your schema';
exports.builder = yargs => {
  addOverwriteOptions(yargs, true);
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);

  yargs
    .command(create)
    .command(remove)
    .command(list);

  return yargs;
};
