#!/usr/bin/env node

const { Command } = require('commander');

const { configureSecretsAddCommand } = require('../commands/secrets/addSecret');

const program = new Command('hs secrets add');
configureSecretsAddCommand(program);
program.parse(process.argv);
