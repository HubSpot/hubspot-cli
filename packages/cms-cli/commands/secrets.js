const { addConfigOptions, addPortalOptions } = require('../lib/commonOpts');

const addSecretCommand = require('./secrets/addSecret');
const listSecretsCommand = require('./secrets/listSecrets');
const deleteSecretCommand = require('./secrets/deleteSecret');
const updateSecretCommand = require('./secrets/updateSecret');

exports.command = 'secrets';
exports.describe = 'Manage HubSpot secrets';

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);
  yargs
    .command(listSecretsCommand)
    .command(addSecretCommand)
    .command(updateSecretCommand)
    .command(deleteSecretCommand)
    .demandCommand(1, '');
  return yargs;
};
