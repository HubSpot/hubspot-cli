#!/usr/bin/env node

const { Command } = require('commander');

const {
  configureFileManagerCommanderCommand,
} = require('../commands/filemanager');

const program = new Command('hs filemanager');
configureFileManagerCommanderCommand(program);
program.parse(process.argv);
