const create = require('./associations/create');
const remove = require('./associations/remove');
const list = require('./associations/list');

exports.command = 'associations';
exports.describe = 'Manage object associations with your schema';
exports.builder = yargs => {
  yargs
    .command(create)
    .command(remove)
    .command(list);

  return yargs;
};
