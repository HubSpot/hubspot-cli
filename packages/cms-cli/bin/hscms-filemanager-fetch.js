#!/usr/bin/env node

const { Command } = require('commander');

const {
  configureCommanderFileManagerFetchCommand,
} = require('../commands/filemanager/fetch');

const program = new Command('hscms filemanager fetch');
configureCommanderFileManagerFetchCommand(program);
program.parse(process.argv);
