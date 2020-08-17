#!/usr/bin/env node

const { Command } = require('commander');

const { configureCommanderInitCommand } = require('../commands/init');

const program = new Command('hs init');
configureCommanderInitCommand(program);
program.parse(process.argv);
