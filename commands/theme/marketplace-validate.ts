// @ts-nocheck
const SpinniesManager = require('../../lib/ui/SpinniesManager');
const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { loadAndValidateOptions } = require('../../lib/validation');
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

exports.command = 'marketplace-validate <src>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { src, derivedAccountId } = options;

  await loadAndValidateOptions(options);

  trackCommandUsage('validate', null, derivedAccountId);

  SpinniesManager.init();

  SpinniesManager.add('marketplaceValidation', {
    text: i18n(`${i18nKey}.logs.validatingTheme`, {
      path: src,
    }),
  });

  const assetType = 'THEME';
  const validationId = await kickOffValidation(
    derivedAccountId,
    assetType,
    src
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

  yargs.positional('src', {
    describe: i18n(`${i18nKey}.positionals.src.describe`),
    type: 'string',
  });
  return yargs;
};
