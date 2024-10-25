// @ts-nocheck
const path = require('path');
const { isConfigFlagEnabled } = require('@hubspot/local-dev-lib/config');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { CONFIG_FLAGS } = require('../../../lib/constants');
const {
  downloadSchema,
  getResolvedPath,
} = require('@hubspot/local-dev-lib/customObjects');
const { fetchSchema } = require('@hubspot/local-dev-lib/api/fileTransport');
const { getCwd } = require('@hubspot/local-dev-lib/path');

const { loadAndValidateOptions } = require('../../../lib/validation');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { i18n } = require('../../../lib/lang');
const { logError } = require('../../../lib/errorHandlers');

const i18nKey = 'commands.customObject.subcommands.schema.subcommands.fetch';

exports.command = 'fetch <name> [dest]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  let { name, dest, derivedAccountId } = options;

  await loadAndValidateOptions(options);

  trackCommandUsage('custom-object-schema-fetch', null, derivedAccountId);

  try {
    if (isConfigFlagEnabled(CONFIG_FLAGS.USE_CUSTOM_OBJECT_HUBFILE)) {
      const fullpath = path.resolve(getCwd(), dest);
      await fetchSchema(derivedAccountId, name, fullpath);
      logger.success(
        i18n(`${i18nKey}.success.save`, {
          name,
          path: fullpath,
        })
      );
    } else {
      await downloadSchema(derivedAccountId, name, dest);
      logger.success(
        i18n(`${i18nKey}.success.savedToPath`, {
          path: getResolvedPath(dest, name),
        })
      );
    }
  } catch (e) {
    logError(e);
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
