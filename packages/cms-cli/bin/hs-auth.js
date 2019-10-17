#!/usr/bin/env node

const { Command } = require('commander');

const { configureAuthCommand } = require('../commands/auth');

const program = new Command('hs auth');
configureAuthCommand(program);
program.parse(process.argv);
