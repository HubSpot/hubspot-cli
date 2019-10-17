#!/usr/bin/env node

const { Command } = require('commander');

const { configureCreateCommand } = require('../commands/create');

const program = new Command('hs create');
configureCreateCommand(program);
program.parse(process.argv);
