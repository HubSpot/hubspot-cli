// @ts-nocheck
const { addGlobalOptions } = require('../lib/commonOpts');

const addSecretCommand = require('./secret/addSecret');
const listSecretsCommand = require('./secret/listSecrets');
const deleteSecretCommand = require('./secret/deleteSecret');
const updateSecretCommand = require('./secret/updateSecret');
const { i18n } = require('../lib/lang');

const i18nKey = 'commands.secret';

exports.command = ['secret', 'secrets'];
exports.describe = i18n(`${i18nKey}.describe`);

exports.builder = yargs => {
  addGlobalOptions(yargs);

  yargs
    .command(listSecretsCommand)
    .command(addSecretCommand)
    .command(updateSecretCommand)
    .command(deleteSecretCommand)
    .demandCommand(1, '');
  return yargs;
};
