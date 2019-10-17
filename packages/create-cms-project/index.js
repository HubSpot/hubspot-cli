#!/usr/bin/env node

const chalk = require('chalk');

const nodeVersion = process.versions.node;
const majorVersion = nodeVersion.split('.')[0] | 0;

if (majorVersion < 8) {
  console.error(
    chalk.red(
      `Node version 8x or greater is required. You are running Node ${nodeVersion}`
    )
  );
  process.exit(1);
}

module.exports = require('./lib/main');
