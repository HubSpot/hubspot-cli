const path = require('path');
const { isConfigFlagEnabled } = require('@hubspot/cli-lib');
const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');
const { ConfigFlags } = require('@hubspot/cli-lib/lib/constants');
const { downloadSchema, getResolvedPath } = require('@hubspot/cli-lib/schema');
const { fetchSchema } = require('@hubspot/cli-lib/api/fileTransport');
const { getCwd } = require('@hubspot/cli-lib/path');

const { loadAndValidateOptions } = require('../../../lib/validation');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { getAccountId } = require('../../../lib/commonOpts');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey =
  'cli.commands.customObject.subcommands.schema.subcommands.fetch';

exports.command = 'fetch <name> [dest]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  let { name, dest } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('custom-object-schema-fetch', null, accountId);

  try {
    if (isConfigFlagEnabled(ConfigFlags.USE_CUSTOM_OBJECT_HUBFILE)) {
      const fullpath = path.resolve(getCwd(), dest);
      await fetchSchema(accountId, name, fullpath);
      logger.success(
        i18n(`${i18nKey}.success.save`, {
          name,
          path: fullpath,
        })
      );
    } else {
      await downloadSchema(accountId, name, dest);
      logger.success(
        i18n(`${i18nKey}.success.savedToPath`, {
          path: getResolvedPath(dest, name),
        })
      );
    }
  } catch (e) {
    logErrorInstance(e);
    logger.error(
      i18n(`${i18nKey}.errors.fetch`, {
        name,
      })
    );
  }
};

exports.builder = yargs => {
  yargs.example([
    [
      '$0 custom-object schema fetch schemaName',
      i18n(`${i18nKey}.examples.default`),
    ],
    [
      '$0 custom-object schema fetch schemaName my/folder',
      i18n(`${i18nKey}.examples.specifyPath`),
    ],
  ]);

  yargs.positional('name', {
    describe: i18n(`${i18nKey}.positionals.name.describe`),
    type: 'string',
  });

  yargs.positional('dest', {
    describe: i18n(`${i18nKey}.positionals.dest.describe`),
    type: 'string',
  });
};
