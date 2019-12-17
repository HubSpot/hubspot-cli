#!/usr/bin/en node

const { Command } = require('commander');

const {
  configureFileManagerUploadCommand,
} = require('../commands/filemanager');

const program = new Command('hscms filemanager upload');
configureFileManagerUploadCommand(program);
program.parse(process.argv);
