#!/usr/bin/env node

const { Command } = require('commander');

const {
  configureSecretsDeleteCommand,
} = require('../commands/secrets/deleteSecret');

const program = new Command('hs secrets delete');
configureSecretsDeleteCommand(program);
program.parse(process.argv);
