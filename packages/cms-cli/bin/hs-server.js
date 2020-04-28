#!/usr/bin/env node

const { Command } = require('commander');

const { configureServerCommand } = require('../commands/server');

const program = new Command('hs server');
configureServerCommand(program);
program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.help();
}
