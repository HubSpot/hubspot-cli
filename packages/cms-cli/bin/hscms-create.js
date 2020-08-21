#!/usr/bin/env node

const { Command } = require('commander');

const { configureCommanderCreateCommand } = require('../commands/create');

const program = new Command('hscms create');
configureCommanderCreateCommand(program);
program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.help();
}
