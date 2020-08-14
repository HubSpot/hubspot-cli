#!/usr/bin/env node

const { Command } = require('commander');

const { configureCommanderLintCommand } = require('../commands/lint');

const program = new Command('hscms lint');
configureCommanderLintCommand(program);
program.parse(process.argv);
