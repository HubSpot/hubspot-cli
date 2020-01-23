#!/usr/bin/env node

const { Command } = require('commander');

const { configureSecretsAddCommand } = require('../commands/secrets');

const program = new Command('hscms secrets add');
configureSecretsAddCommand(program);
program.parse(process.argv);
