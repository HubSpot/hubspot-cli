#!/usr/bin/env node

const { Command } = require('commander');

const { configureSecretsListCommand } = require('../commands/secrets');

const program = new Command('hscms secrets list');
configureSecretsListCommand(program);
program.parse(process.argv);
