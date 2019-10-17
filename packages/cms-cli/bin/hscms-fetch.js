#!/usr/bin/env node

const { Command } = require('commander');
const { configureFetchCommand } = require('../commands/fetch');
const program = new Command('hscms fetch');
configureFetchCommand(program);
program.parse(process.argv);
