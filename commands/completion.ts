// @ts-nocheck
const yargsParser = require('yargs-parser');
const { i18n } = require('../lib/lang');
const { trackCommandUsage } = require('../lib/usageTracking');

exports.command = 'completion';
exports.describe = i18n('commands.completion.describe');

exports.handler = async () => {
  await trackCommandUsage('completion');
};

exports.builder = yargs => {
  const { help } = yargsParser(process.argv.slice(2));

  if (!help) {
    yargs.completion();
  }

  yargs.example([
    ['$0 completion >> ~/.zshrc', i18n('commands.completion.examples.default')],
  ]);
  return yargs;
};
