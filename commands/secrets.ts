// @ts-nocheck

const addSecretCommand = require('./secrets/addSecret');
const listSecretsCommand = require('./secrets/listSecrets');
const deleteSecretCommand = require('./secrets/deleteSecret');
const updateSecretCommand = require('./secrets/updateSecret');
const { i18n } = require('../lib/lang');

const i18nKey = 'commands.secrets';

exports.command = ['secret', 'secrets'];
exports.describe = i18n(`${i18nKey}.describe`);

exports.builder = yargs => {
  yargs
    .command(listSecretsCommand)
    .command(addSecretCommand)
    .command(updateSecretCommand)
    .command(deleteSecretCommand)
    .demandCommand(1, '');
  return yargs;
};
