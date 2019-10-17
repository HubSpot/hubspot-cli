#!/usr/bin/env node

const { Command } = require('commander');

const { configureCommand } = require('../commands/lint');

const program = new Command('hscms lint');
configureCommand(program);
program.parse(process.argv);
