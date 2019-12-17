#!/usr/bin/en node

const { Command } = require('commander');

const { configureFileManagerCommand } = require('../commands/filemanager');

const program = new Command('hscms filemanager');
configureFileManagerCommand(program);
program.parse(process.argv);
