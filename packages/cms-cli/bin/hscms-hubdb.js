#!/usr/bin/en node

const { Command } = require('commander');

const { configureHubDbCommand } = require('../commands/hubdb');

const program = new Command('hs hubdb');
configureHubDbCommand(program);
program.parse(process.argv);
