#!/usr/bin/env node

const { Command } = require('commander');

const { configureHubDbDeleteCommand } = require('../commands/hubdb');

const program = new Command('hs hubdb delete');
configureHubDbDeleteCommand(program);
program.parse(process.argv);
