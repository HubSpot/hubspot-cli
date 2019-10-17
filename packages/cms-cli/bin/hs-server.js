#!/usr/bin/en node

const { Command } = require('commander');

const { configureServerCommand } = require('../commands/server');

const program = new Command('hs server');
configureServerCommand(program);
program.parse(process.argv);
