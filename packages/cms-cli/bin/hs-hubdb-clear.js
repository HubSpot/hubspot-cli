#!/usr/bin/env node

const { Command } = require('commander');

const { configureHubDbClearCommand } = require('../commands/hubdb');

const program = new Command('hs hubdb clear');
configureHubDbClearCommand(program);
program.parse(process.argv);
