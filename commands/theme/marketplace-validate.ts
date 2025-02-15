// @ts-nocheck
const SpinniesManager = require('../../lib/ui/SpinniesManager');
const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const {
  kickOffValidation,
  pollForValidationFinish,
  fetchValidationResults,
  processValidationErrors,
  displayValidationResults,
} = require('../../lib/marketplaceValidate');
const { i18n } = require('../../lib/lang');

const i18nKey = 'commands.theme.subcommands.marketplaceValidate';

exports.command = 'marketplace-validate <path>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { path, derivedAccountId } = options;

  trackCommandUsage('validate', null, derivedAccountId);

  SpinniesManager.init();

  SpinniesManager.add('marketplaceValidation', {
    text: i18n(`${i18nKey}.logs.validatingTheme`, {
      path,
    }),
  });

  const assetType = 'THEME';
  const validationId = await kickOffValidation(
    derivedAccountId,
    assetType,
    path
  );
  await pollForValidationFinish(derivedAccountId, validationId);

  SpinniesManager.remove('marketplaceValidation');

  const validationResults = await fetchValidationResults(
    derivedAccountId,
    validationId
  );
  processValidationErrors(i18nKey, validationResults);
  displayValidationResults(i18nKey, validationResults);

  process.exit();
};

exports.builder = yargs => {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs.positional('path', {
    describe: i18n(`${i18nKey}.positionals.path.describe`),
    type: 'string',
  });
  return yargs;
};
