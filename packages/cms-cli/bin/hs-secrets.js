#!/usr/bin/env node

const { Command } = require('commander');

const { configureSecretsCommand } = require('../commands/secrets');

const program = new Command('hs secrets');
configureSecretsCommand(program);
program.parse(process.argv);
