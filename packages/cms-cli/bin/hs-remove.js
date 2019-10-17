#!/usr/bin/env node

const { Command } = require('commander');

const { configureRemoveCommand } = require('../commands/remove');

const program = new Command('hs remove');
configureRemoveCommand(program);
program.parse(process.argv);
