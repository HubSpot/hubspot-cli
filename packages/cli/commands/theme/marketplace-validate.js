const SpinniesManager = require('../../lib/SpinniesManager');
const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  getAccountId,
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

const i18nKey = 'cli.commands.theme.subcommands.marketplaceValidate';

exports.command = 'marketplace-validate <src>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { src } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('validate', null, accountId);

  SpinniesManager.init();

  SpinniesManager.add('marketplaceValidation', {
    text: i18n(`${i18nKey}.logs.validatingTheme`, {
      path: src,
    }),
  });

  const assetType = 'THEME';
  const validationId = await kickOffValidation(accountId, assetType, src);
  await pollForValidationFinish(accountId, validationId);

  SpinniesManager.remove('marketplaceValidation');

  const validationResults = await fetchValidationResults(
    accountId,
    validationId
  );
  processValidationErrors(validationResults);
  displayValidationResults(i18nKey, validationResults);

  process.exit();
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.positional('src', {
    describe: i18n(`${i18nKey}.positionals.src.describe`),
    type: 'string',
  });
  return yargs;
};
