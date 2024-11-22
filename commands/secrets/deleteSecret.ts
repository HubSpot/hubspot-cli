// @ts-nocheck
import { secretListPrompt } from '../../lib/prompts/secretPrompt';
import { confirmPrompt } from '../../lib/prompts/promptUtils';
import { EXIT_CODES } from '../../lib/enums/exitCodes';

const { logger } = require('@hubspot/local-dev-lib/logger');
const { ApiErrorContext, logError } = require('../../lib/errorHandlers/index');
const {
  deleteSecret,
  fetchSecrets,
} = require('@hubspot/local-dev-lib/api/secrets');

const { loadAndValidateOptions } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { uiAccountDescription } = require('../../lib/ui');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  getAccountId,
} = require('../../lib/commonOpts');
const { i18n } = require('../../lib/lang');

const i18nKey = 'commands.secrets.subcommands.delete';

exports.command = 'delete [name]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { name, force } = options;
  let secretName = name;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);
  trackCommandUsage('secrets-delete', null, accountId);

  try {
    const {
      data: { results: secrets },
    } = await fetchSecrets(accountId);

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

    const confirmDelete =
      force ||
      (await confirmPrompt(i18n(`${i18nKey}.confirmDelete`, { secretName }), {
        defaultAnswer: false,
      }));

    if (!confirmDelete) {
      logger.success(i18n(`${i18nKey}.deleteCanceled`));
      process.exit(EXIT_CODES.SUCCESS);
    }

    await deleteSecret(accountId, secretName);
    logger.success(
      i18n(`${i18nKey}.success.delete`, {
        accountIdentifier: uiAccountDescription(accountId),
        secretName,
      })
    );
  } catch (err) {
    logger.error(
      i18n(`${i18nKey}.errors.delete`, {
        secretName,
      })
    );
    logError(
      err,
      new ApiErrorContext({
        request: 'delete a secret',
        accountId,
      })
    );
  }
};

exports.builder = yargs => {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);
  yargs
    .positional('name', {
      describe: i18n(`${i18nKey}.positionals.name.describe`),
      type: 'string',
    })
    .options('force', {
      describe: 'Force the deletion',
      type: 'boolean',
    });
  return yargs;
};
