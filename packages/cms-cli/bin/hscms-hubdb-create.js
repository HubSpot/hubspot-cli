#!/usr/bin/en node

const { Command } = require('commander');

const { configureHubDbCreateCommand } = require('../commands/hubdb');

const program = new Command('hscms hubdb create');
configureHubDbCreateCommand(program);
program.parse(process.argv);
