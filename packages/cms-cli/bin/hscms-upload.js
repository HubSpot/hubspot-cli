#!/usr/bin/env node

const { Command } = require('commander');
const { configureUploadCommand } = require('../commands/upload');

const program = new Command('hscms upload');
configureUploadCommand(program);
program.parse(process.argv);
