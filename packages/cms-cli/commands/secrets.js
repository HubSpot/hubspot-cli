const { version } = require('../package.json');
const { addHelpUsageTracking } = require('../lib/usageTracking');
const { addConfigOptions, addPortalOptions } = require('../lib/commonOpts');

const addSecretCommand = require('./secrets/addSecret');
const listSecretsCommand = require('./secrets/listSecrets');
const deleteSecretCommand = require('./secrets/deleteSecret');
const updateSecretCommand = require('./secrets/updateSecret');

const DESCRIPTION = 'Manage HubSpot secrets';

function configureSecretsCommand(program) {
  program
    .version(version)
    .description(DESCRIPTION)
    .command('add <name> <value>', 'add a HubSpot secret')
    .command('update <name> <value>', 'update an existing HubSpot secret')
    .command('delete <name>', 'delete a HubSpot secret')
    .command('list', 'list all HubSpot secrets');

  addHelpUsageTracking(program);
}

exports.command = 'secrets';

exports.describe = DESCRIPTION;

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);
  yargs
    .command(listSecretsCommand)
    .command(addSecretCommand)
    .command(updateSecretCommand)
    .command(deleteSecretCommand)
    .help()
    .recommendCommands()
    .strict().argv;
};

exports.configureSecretsCommand = configureSecretsCommand;
