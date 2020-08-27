#!/usr/bin/env node

const { Command } = require('commander');

const {
  configureCommanderHubDbClearCommand,
} = require('../commands/hubdb/clear');

const program = new Command('hs hubdb clear');
configureCommanderHubDbClearCommand(program);
program.parse(process.argv);
