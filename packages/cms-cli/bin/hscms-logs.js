#!/usr/bin/env node

const { Command } = require('commander');

const { configureCommanderLogsCommand } = require('../commands/logs');

const program = new Command('hscms logs');
configureCommanderLogsCommand(program);
program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.help();
}
