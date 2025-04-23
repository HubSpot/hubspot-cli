// @ts-nocheck
const { addGlobalOptions } = require('../lib/commonOpts');
const list = require('./function/list');
const deploy = require('./function/deploy');
const server = require('./function/server');
const { i18n } = require('../lib/lang');

exports.command = ['function', 'functions'];
exports.describe = i18n(`commands.function.describe`);

exports.builder = yargs => {
  addGlobalOptions(yargs);
  yargs.command(list).command(deploy).command(server).demandCommand(1, '');

  return yargs;
};
