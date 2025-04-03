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


exports.command = 'marketplace-validate <src>';
exports.describe = i18n(`commands.module.subcommands.marketplaceValidate.describe`);

exports.handler = async options => {
  const { src, derivedAccountId } = options;

  trackCommandUsage('validate', null, derivedAccountId);

  SpinniesManager.init();

  SpinniesManager.add('marketplaceValidation', {
    text: i18n(`commands.module.subcommands.marketplaceValidate.logs.validatingModule`, {
      path: src,
    }),
  });

  const assetType = 'MODULE';
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
  processValidationErrors('commands.module.subcommands.marketplaceValidate', validationResults);
  displayValidationResults('commands.module.subcommands.marketplaceValidate', validationResults);

  process.exit();
};

exports.builder = yargs => {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs.positional('src', {
    describe: i18n(`commands.module.subcommands.marketplaceValidate.positionals.src.describe`),
    type: 'string',
  });
  return yargs;
};
