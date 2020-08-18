#!/usr/bin/env node

const { Command } = require('commander');

const { configureCommanderAuthCommand } = require('../commands/auth');

const program = new Command('hs auth');
configureCommanderAuthCommand(program);
program.parse(process.argv);
