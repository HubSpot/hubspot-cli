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
 *   options:   Object - The options object passed to the command by Yargs
 * }
 */

const fs = require('fs-extra');
const {
  logFileSystemErrorInstance,
} = require('../lib/errorHandlers/fileSystemErrors');
const { logger } = require('@hubspot/cli-lib/logger');
const { setLogLevel, getAccountId } = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const { resolveLocalPath } = require('../lib/filesystem');
const { trackCommandUsage } = require('../lib/usageTracking');
const assets = require('./create/index');
const { i18n } = require('../lib/lang');

const i18nKey = 'cli.commands.create';

const SUPPORTED_ASSET_TYPES = Object.keys(assets)
  .filter(t => !assets[t].hidden)
  .join(', ');

exports.command = 'create <type> [name] [dest]';
exports.describe = i18n(`${i18nKey}.describe`, {
  supportedAssetTypes: SUPPORTED_ASSET_TYPES,
});

exports.handler = async options => {
  let { type: assetType, name, dest } = options;

  setLogLevel(options);
  logDebugInfo(options);
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
  const argsToPass = { assetType, name, dest, options };
  dest = argsToPass.dest = resolveLocalPath(asset.dest(argsToPass));

  trackCommandUsage('create', { assetType }, getAccountId(options));

  try {
    await fs.ensureDir(dest);
  } catch (e) {
    logger.error(
      i18n(`${i18nKey}.errors.unusablePath`, {
        path: dest,
      })
    );
    logFileSystemErrorInstance(e, {
      filepath: dest,
      write: true,
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

  return yargs;
};
