#!/usr/bin/en node

const { Command } = require('commander');

const { configureSecretsCommand } = require('../commands/secrets');

const program = new Command('hscms secrets');
configureSecretsCommand(program);
program.parse(process.argv);
