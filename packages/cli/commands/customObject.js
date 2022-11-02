const chalk = require('chalk');
const { addConfigOptions, addAccountOptions } = require('../lib/commonOpts');
const schemaCommand = require('./customObject/schema');
const createCommand = require('./customObject/create');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { logger } = require('@hubspot/cli-lib/logger');
const { uiBetaWarning } = require('../lib/ui');

const i18nKey = 'cli.commands.customObject';

exports.command = ['custom-object', 'custom', 'co'];
exports.describe = i18n(`${i18nKey}.describe`);

const logBetaMessage = () => {
  uiBetaWarning(() => {
    logger.log(chalk.reset.yellow(i18n(`${i18nKey}.betaMessage`)));
    logger.log(
      chalk.reset.yellow(
        i18n(`${i18nKey}.seeMoreLink`, {
          link:
            'https://developers.hubspot.com/docs/api/crm/crm-custom-objects',
        })
      )
    );
  });
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs
    .middleware([logBetaMessage])
    .command(schemaCommand)
    .command(createCommand)
    .demandCommand(1, '');

  return yargs;
};
