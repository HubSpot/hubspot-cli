#!/usr/bin/env node

const { Command } = require('commander');

const { configureHubDbImportCommand } = require('../commands/hubdb');

const program = new Command('hs hubdb import');
configureHubDbImportCommand(program);
program.parse(process.argv);
