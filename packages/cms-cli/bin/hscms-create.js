#!/usr/bin/env node

const { Command } = require('commander');

const { configureCreateCommand } = require('../commands/create');

const program = new Command('hscms create');
configureCreateCommand(program);
program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.help();
}
