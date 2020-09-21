const createCommand = require('./batch/create');

exports.command = 'batch';
exports.describe = 'Manage multiple custom object instances';
exports.builder = yargs => {
  yargs.command(createCommand);

  return yargs;
};
