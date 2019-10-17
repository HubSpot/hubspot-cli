#!/usr/bin/env node

const { Command } = require('commander');
const { configureWatchCommand } = require('../commands/watch');
const program = new Command('hscms watch');
configureWatchCommand(program);
program.parse(process.argv);
