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
} = require('../../lib/marketplace-validate');
const { i18n } = require('../../lib/lang');

const i18nKey = 'commands.module.subcommands.marketplaceValidate';

exports.command = 'marketplace-validate <src>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { src, account } = options;

  await loadAndValidateOptions(options);

  trackCommandUsage('validate', null, account);

  SpinniesManager.init();

  SpinniesManager.add('marketplaceValidation', {
    text: i18n(`${i18nKey}.logs.validatingModule`, {
      path: src,
    }),
  });

  const assetType = 'MODULE';
  const validationId = await kickOffValidation(account, assetType, src);
  await pollForValidationFinish(account, validationId);

  SpinniesManager.remove('marketplaceValidation');

  const validationResults = await fetchValidationResults(account, validationId);
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
