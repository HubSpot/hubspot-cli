#!/usr/bin/env node

const { Command } = require('commander');

const { configureFileManagerFetchCommand } = require('../commands/filemanager');

const program = new Command('hscms filemanager fetch');
configureFileManagerFetchCommand(program);
program.parse(process.argv);
