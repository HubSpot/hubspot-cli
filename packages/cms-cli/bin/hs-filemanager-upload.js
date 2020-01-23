#!/usr/bin/env node

const { Command } = require('commander');

const {
  configureFileManagerUploadCommand,
} = require('../commands/filemanager');

const program = new Command('hs filemanager upload');
configureFileManagerUploadCommand(program);
program.parse(process.argv);
