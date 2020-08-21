#!/usr/bin/env node

const { Command } = require('commander');

const {
  configureCommanderHubDbCreateCommand,
} = require('../commands/hubdb/create');

const program = new Command('hscms hubdb create');
configureCommanderHubDbCreateCommand(program);
program.parse(process.argv);
