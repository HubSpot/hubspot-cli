// @ts-nocheck
/**
 * To add a new asset type: See vue-app.js for a simple example
 * 1. Create a new file under the `create` directory with the command name being the name of the file
 * 2. The file _must_ export a `dest` function and an `execute` function.  See below for details
 * Note: No changes should be needed to this file when adding new types, unless you need new functionality
 *
 * @export {(Data) => String} dest - A function returning the destination of the asset we are creating
 * @export {(Data) => Object=} execute - The code called once all other checks pass. This should contain the logic
 *                                       for handling your command.  Optionally return an object containing KV pairs
 *                                       of any context or data you want passed along to usage tracking
 * @export {Boolean=} hidden - If true, the command will not show up in --help
 * @export {(Data) => Boolean=} validate - If provided, return true if it passes validation, false otherwise.
 *                                         If not provided, validation will automatically succeed
 *
 * The Data object contains
 * {
 *   assetType: String - Type of the asset (e.g. api-sample, react-app, template)
 *   name:      String - Filename of the asset
 *   dest:      String - The path specified by the user on where to create the asset
 *   internal:  Boolean - A flag for retrieving the internal spec for the asset type
 *   options:   Object - The options object passed to the command by Yargs
 * }
 */

const fs = require('fs-extra');
const { logError } = require('../lib/errorHandlers/index');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  setLogLevel,
  addGlobalOptions,
  addConfigOptions,
} = require('../lib/commonOpts');
const { resolveLocalPath } = require('../lib/filesystem');
const { trackCommandUsage } = require('../lib/usageTracking');
const assets = require('./create/index');
const { i18n } = require('../lib/lang');

const i18nKey = 'commands.create';

const SUPPORTED_ASSET_TYPES = Object.keys(assets)
  .filter(t => !assets[t].hidden)
  .join(', ');

exports.command = 'create <type> [name] [dest]';
exports.describe = i18n(`${i18nKey}.describe`, {
  supportedAssetTypes: SUPPORTED_ASSET_TYPES,
});

exports.handler = async options => {
  let { type: assetType, dest } = options;
  const { name, internal: getInternalVersion } = options;

  setLogLevel(options);
  assetType = typeof assetType === 'string' && assetType.toLowerCase();

  if (assetType === 'global-partial') {
    logger.error(
      i18n(`${i18nKey}.errors.deprecatedAssetType`, {
        assetType,
        newCommand: 'hs create template',
        type: 'global partial',
      })
    );
    return;
  }

  if (!assetType || !assets[assetType]) {
    logger.error(
      i18n(`${i18nKey}.errors.unsupportedAssetType`, {
        assetType,
        supportedAssetTypes: SUPPORTED_ASSET_TYPES,
      })
    );
    return;
  }

  const asset = assets[assetType];
  const argsToPass = { assetType, name, dest, getInternalVersion, options };
  dest = argsToPass.dest = resolveLocalPath(asset.dest(argsToPass));

  const { derivedAccountId } = options;
  trackCommandUsage('create', { assetType }, derivedAccountId);

  try {
    await fs.ensureDir(dest);
  } catch (e) {
    logger.error(
      i18n(`${i18nKey}.errors.unusablePath`, {
        path: dest,
      })
    );
    logError(e, {
      filepath: dest,
      operation: 'write',
    });
    return;
  }

  if (asset.validate && !asset.validate(argsToPass)) return;

  await asset.execute(argsToPass);
};

exports.builder = yargs => {
  yargs.positional('type', {
    describe: i18n(`${i18nKey}.positionals.type.describe`),
    type: 'string',
  });
  yargs.positional('name', {
    describe: i18n(`${i18nKey}.positionals.name.describe`),
    type: 'string',
  });
  yargs.positional('dest', {
    describe: i18n(`${i18nKey}.positionals.dest.describe`),
    type: 'string',
  });
  yargs.option('internal', {
    describe: 'Internal HubSpot version of creation command',
    type: 'boolean',
    hidden: true,
  });

  addConfigOptions(yargs);
  addGlobalOptions(yargs);

  return yargs;
};
