#!/usr/bin/env node

const { Command } = require('commander');

const { configureAuthCommand } = require('../commands/auth');

const program = new Command('hscms auth');
configureAuthCommand(program);
program.parse(process.argv);
