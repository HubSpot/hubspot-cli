#!/usr/bin/env node

const { Command } = require('commander');

const { runTest } = require('../commands/test');

const program = new Command('hs test');
runTest(program);
program.parse(process.argv);
