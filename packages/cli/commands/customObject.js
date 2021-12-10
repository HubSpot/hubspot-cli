const { addConfigOptions, addAccountOptions } = require('../lib/commonOpts');
const schemaCommand = require('./customObject/schema');
const createCommand = require('./customObject/create');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.customObject';

exports.command = ['custom-object', 'custom', 'co'];
exports.describe = i18n(`${i18nKey}.describe`);

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs
    .command(schemaCommand)
    .command(createCommand)
    .demandCommand(1, '');

  console.warn(i18n(`${i18nKey}.warning`));
  console.warn(i18n(`${i18nKey}.betaMessage`));
  console.warn(
    i18n(`${i18nKey}.seeMoreLink`, {
      link: 'https://developers.hubspot.com/docs/api/crm/crm-custom-objects',
    })
  );
  console.warn(i18n(`${i18nKey}.warning`));

  return yargs;
};
