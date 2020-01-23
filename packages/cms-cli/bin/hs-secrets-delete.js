#!/usr/bin/env node

const { Command } = require('commander');

const { configureSecretsDeleteCommand } = require('../commands/secrets');

const program = new Command('hs secrets delete');
configureSecretsDeleteCommand(program);
program.parse(process.argv);
