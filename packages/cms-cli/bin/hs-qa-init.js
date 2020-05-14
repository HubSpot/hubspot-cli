#!/usr/bin/env node

const { Command } = require('commander');

const { qaInitCommand } = require('../commands/qa');

const program = new Command('hs qa init');
qaInitCommand(program);
program.parse(process.argv);
