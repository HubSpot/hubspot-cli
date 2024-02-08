const marketplaceValidate = require('./theme/marketplace-validate');
const generateSelectors = require('./theme/generate-selectors');
const previewCommand = require('./theme/preview');

const { i18n } = require('../lib/lang');

const i18nKey = 'cli.commands.theme';

exports.command = 'theme';
exports.describe = i18n(`${i18nKey}.describe`);

exports.builder = yargs => {
  yargs
    .command(previewCommand)
    .command(marketplaceValidate)
    .command(generateSelectors)
    .demandCommand(1, '');

  return yargs;
};
