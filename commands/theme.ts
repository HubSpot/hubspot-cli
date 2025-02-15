// @ts-nocheck
const marketplaceValidate = require('./theme/marketplace-validate');
const generateSelectors = require('./theme/generate-selectors');
const previewCommand = require('./theme/preview');
const { addGlobalOptions } = require('../lib/commonOpts');

const { i18n } = require('../lib/lang');

const i18nKey = 'commands.theme';

exports.command = ['theme', 'themes'];
exports.describe = i18n(`${i18nKey}.describe`);

exports.builder = yargs => {
  addGlobalOptions(yargs);

  yargs
    .command(previewCommand)
    .command(marketplaceValidate)
    .command(generateSelectors)
    .demandCommand(1, '');

  return yargs;
};
