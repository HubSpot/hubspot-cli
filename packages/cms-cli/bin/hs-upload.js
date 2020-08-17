#!/usr/bin/env node

const { Command } = require('commander');

const { configureCommanderUploadCommand } = require('../commands/upload');

const program = new Command('hs upload');
configureCommanderUploadCommand(program);
program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.help();
}
