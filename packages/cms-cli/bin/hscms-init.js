#!/usr/bin/env node

const { Command } = require('commander');

const { configureCommanderInitCommand } = require('../commands/init');

const program = new Command('hscms init');
configureCommanderInitCommand(program);
program.parse(process.argv);
