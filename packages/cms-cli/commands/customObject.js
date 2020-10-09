const { addConfigOptions, addAccountOptions } = require('../lib/commonOpts');
const schemaCommand = require('./customObject/schema');
const createCommand = require('./customObject/create');
const chalk = require('chalk');

exports.command = ['custom-object', 'custom', 'co'];
exports.describe =
  'Manage Custom Objects.  This feature is currently in beta and the CLI contract is subject to change';

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs
    .command(schemaCommand)
    .command(createCommand)
    .demandCommand(1, '');

  console.warn(
    chalk.reset.yellow(
      '***************************** WARNING WARNING WARNING ****************************'
    )
  );
  console.warn(
    chalk.reset.yellow(
      'The Custom Object CLI is currently in beta and is subject to change.'
    )
  );
  console.warn(
    chalk.reset.yellow(
      'See https://developers.hubspot.com/docs/api/crm/crm-custom-objects to find out more.'
    )
  );
  console.warn(
    chalk.reset.yellow(
      '***************************** WARNING WARNING WARNING ****************************'
    )
  );

  return yargs;
};
