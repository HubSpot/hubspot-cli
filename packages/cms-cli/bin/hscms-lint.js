#!/usr/bin/env node

const { Command } = require('commander');

const { configureLintCommand } = require('../commands/lint');

const program = new Command('hscms lint');
configureLintCommand(program);
program.parse(process.argv);
