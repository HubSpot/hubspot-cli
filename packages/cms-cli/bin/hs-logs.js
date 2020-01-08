#!/usr/bin/env node

const { Command } = require('commander');

const { getLogs } = require('../commands/logs');

const program = new Command('hs logs');
getLogs(program);
program.parse(process.argv);
