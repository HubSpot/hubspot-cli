#!/usr/bin/env node

const { Command } = require('commander');

const { configureHubDbFetchCommand } = require('../commands/hubdb');

const program = new Command('hscms hubdb fetch');
configureHubDbFetchCommand(program);
program.parse(process.argv);
