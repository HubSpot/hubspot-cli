#!/usr/bin/env node

const { Command } = require('commander');
const { configureCommanderWatchCommand } = require('../commands/watch');
const program = new Command('hs watch');
configureCommanderWatchCommand(program);
program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.help();
}
