// @ts-nocheck
const yargsParser = require('yargs-parser');
const { i18n } = require('../lib/lang');
const { trackCommandUsage } = require('../lib/usageTracking');

const i18nKey = 'commands.completion';

exports.command = 'completion';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async () => {
  await trackCommandUsage('completion');
};

exports.builder = yargs => {
  const { help } = yargsParser(process.argv.slice(2));

  if (!help) {
    yargs.completion();
  }

  yargs.example([
    ['$0 completion >> ~/.zshrc', i18n(`${i18nKey}.examples.default`)],
  ]);
  return yargs;
};
