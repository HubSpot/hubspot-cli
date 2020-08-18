#!/usr/bin/env node

const { Command } = require('commander');

const { configureCommanderCreateCommand } = require('../commands/hubdb');

const program = new Command('hs hubdb create');
configureCommanderCreateCommand(program);
program.parse(process.argv);
