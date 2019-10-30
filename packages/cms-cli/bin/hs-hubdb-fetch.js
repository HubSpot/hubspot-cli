#!/usr/bin/en node

const { Command } = require('commander');

const { configureHubDbFetchCommand } = require('../commands/hubdb');

const program = new Command('hs hubdb fetch');
configureHubDbFetchCommand(program);
program.parse(process.argv);
