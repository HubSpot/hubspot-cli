#!/usr/bin/env node

const { Command } = require('commander');
const { configureCommanderFetchCommand } = require('../commands/fetch');
const program = new Command('hscms fetch');
configureCommanderFetchCommand(program);
program.parse(process.argv);
