#!/usr/bin/env node

const { Command } = require('commander');

const { configureCommanderHubDbCommand } = require('../commands/hubdb');

const program = new Command('hs hubdb');
configureCommanderHubDbCommand(program);
program.parse(process.argv);
