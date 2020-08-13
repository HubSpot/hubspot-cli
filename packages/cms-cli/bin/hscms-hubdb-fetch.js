#!/usr/bin/env node

const { Command } = require('commander');

const {
  configureCommanderHubDbFetchCommand,
} = require('../commands/hubdb/fetch');

const program = new Command('hscms hubdb fetch');
configureCommanderHubDbFetchCommand(program);
program.parse(process.argv);
