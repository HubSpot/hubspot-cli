#!/usr/bin/env node

const { Command } = require('commander');

const { configureSecretsDeleteCommand } = require('../commands/secrets');

const program = new Command('hscms secrets delete');
configureSecretsDeleteCommand(program);
program.parse(process.argv);
