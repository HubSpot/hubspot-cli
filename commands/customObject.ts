// @ts-nocheck
const { addGlobalOptions } = require('../lib/commonOpts');
const schemaCommand = require('./customObject/schema');
const createCommand = require('./customObject/create');
const { i18n } = require('../lib/lang');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { uiBetaTag, uiLink } = require('../lib/ui');

const i18nKey = 'commands.customObject';

exports.command = ['custom-object', 'custom-objects', 'co'];
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

const logBetaMessage = () => {
  uiBetaTag(i18n(`${i18nKey}.betaMessage`));
  logger.log(
    uiLink(
      i18n(`${i18nKey}.seeMoreLink`),
      'https://developers.hubspot.com/docs/api/crm/crm-custom-objects'
    )
  );
  logger.log();
};

exports.builder = yargs => {
  addGlobalOptions(yargs);

  yargs
    .middleware([logBetaMessage])
    .command(schemaCommand)
    .command(createCommand)
    .demandCommand(1, '');

  return yargs;
};
