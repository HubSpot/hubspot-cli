#!/usr/bin/env node

const { Command } = require('commander');

const { configureSecretsUpdateCommand } = require('../commands/secrets');

const program = new Command('hscms secrets update');
configureSecretsUpdateCommand(program);
program.parse(process.argv);
