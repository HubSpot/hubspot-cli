const { addConfigOptions, addAccountOptions } = require('../lib/commonOpts');

const addSecretCommand = require('./secrets/addSecret');
const listSecretsCommand = require('./secrets/listSecrets');
const deleteSecretCommand = require('./secrets/deleteSecret');
const updateSecretCommand = require('./secrets/updateSecret');
const { i18n } = require('../lib/lang');

const i18nKey = 'cli.commands.secrets';

exports.command = 'secrets';
exports.describe = i18n(`${i18nKey}.describe`);

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  yargs
    .command(listSecretsCommand)
    .command(addSecretCommand)
    .command(updateSecretCommand)
    .command(deleteSecretCommand)
    .demandCommand(1, '');
  return yargs;
};
