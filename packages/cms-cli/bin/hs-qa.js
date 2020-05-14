#!/usr/bin/env node

const { Command } = require('commander');

const { qaCommand } = require('../commands/qa');

const program = new Command('hs qa');
qaCommand(program);
program.parse(process.argv);
