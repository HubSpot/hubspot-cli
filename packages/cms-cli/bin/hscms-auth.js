#!/usr/bin/env node

const { Command } = require('commander');

const { configureCommanderAuthCommand } = require('../commands/auth');

const program = new Command('hscms auth');
configureCommanderAuthCommand(program);
program.parse(process.argv);
