// @ts-nocheck
import { EXIT_CODES } from '../../lib/enums/exitCodes';

const { logger } = require('@hubspot/local-dev-lib/logger');
const { ApiErrorContext, logError } = require('../../lib/errorHandlers/index');
const {
  updateSecret,
  fetchSecrets,
} = require('@hubspot/local-dev-lib/api/secrets');

const { loadAndValidateOptions } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { uiAccountDescription } = require('../../lib/ui');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const {
  secretValuePrompt,
  secretListPrompt,
} = require('../../lib/prompts/secretPrompt');
const { i18n } = require('../../lib/lang');

const i18nKey = 'commands.secret.subcommands.update';

exports.command = 'update [name]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { name, derivedAccountId } = options;

  let secretName = name;
  await loadAndValidateOptions(options);

  trackCommandUsage('secrets-update', null, derivedAccountId);

  try {
    const {
      data: { results: secrets },
    } = await fetchSecrets(derivedAccountId);

    if (secretName && !secrets.includes(secretName)) {
      logger.error(i18n(`${i18nKey}.errors.noSecret`, { secretName }));
      process.exit(EXIT_CODES.ERROR);
    }

    if (!secretName) {
      const { secretToModify } = await secretListPrompt(
        secrets,
        i18n(`${i18nKey}.selectSecret`)
      );
      secretName = secretToModify;
    }

    const { secretValue } = await secretValuePrompt();

    await updateSecret(derivedAccountId, secretName, secretValue);
    logger.success(
      i18n(`${i18nKey}.success.update`, {
        accountIdentifier: uiAccountDescription(derivedAccountId),
        secretName,
      })
    );
    logger.log(i18n(`${i18nKey}.success.updateExplanation`));
  } catch (err) {
    logger.error(
      i18n(`${i18nKey}.errors.update`, {
        secretName,
      })
    );
    logError(
      err,
      new ApiErrorContext({
        request: 'update secret',
        accountId: derivedAccountId,
      })
    );
  }
};

exports.builder = yargs => {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);
  yargs.positional('name', {
    describe: i18n(`${i18nKey}.positionals.name.describe`),
    type: 'string',
  });
  return yargs;
};
