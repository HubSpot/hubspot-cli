#!/usr/bin/env node

const { Command } = require('commander');

const {
  configureCommanderHubDbDeleteCommand,
} = require('../commands/hubdb/delete');

const program = new Command('hs hubdb delete');
configureCommanderHubDbDeleteCommand(program);
program.parse(process.argv);
