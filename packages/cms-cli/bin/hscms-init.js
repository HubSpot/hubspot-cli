#!/usr/bin/env node

const { Command } = require('commander');

const { initializeConfigCommand } = require('../commands/init');

const program = new Command('hscms init');
initializeConfigCommand(program);
program.parse(process.argv);
