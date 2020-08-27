#!/usr/bin/env node

const { Command } = require('commander');
const { configureCommanderFetchCommand } = require('../commands/fetch');
const program = new Command('hs fetch');
configureCommanderFetchCommand(program);
program.parse(process.argv);
