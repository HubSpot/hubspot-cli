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
} = require('@hubspot/cli-lib/errorHandlers');
const { logger } = require('@hubspot/cli-lib/logger');
const { setLogLevel, getAccountId } = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const { resolveLocalPath } = require('../lib/filesystem');
const { trackCommandUsage } = require('../lib/usageTracking');
const assets = require('./create/index');

const SUPPORTED_ASSET_TYPES = Object.keys(assets)
  .filter(t => !assets[t].hidden)
  .join(', ');

exports.command = 'create <type> [name] [dest]';
exports.describe = `Create HubSpot sample apps and CMS assets. Supported assets are ${SUPPORTED_ASSET_TYPES}.`;

exports.handler = async options => {
  let { type: assetType, name, dest } = options;

  setLogLevel(options);
  logDebugInfo(options);
  assetType = typeof assetType === 'string' && assetType.toLowerCase();

  if (assetType === 'global-partial') {
    logger.error(
      `The CLI command for asset type ${assetType} has been deprecated in an effort to make it easier to know what asset types can be created. Run the "hs create template" command instead. Then when prompted select "global partial".`
    );
    return;
  }

  if (!assetType || !assets[assetType]) {
    logger.error(
      `The asset type ${assetType} is not supported. Supported asset types are ${SUPPORTED_ASSET_TYPES}.`
    );
    return;
  }

  const asset = assets[assetType];
  const argsToPass = { assetType, name, dest, options };
  dest = argsToPass.dest = resolveLocalPath(asset.dest(argsToPass));

  try {
    await fs.ensureDir(dest);
  } catch (e) {
    logger.error(`The "${dest}" is not a usable path to a directory`);
    logFileSystemErrorInstance(e, {
      filepath: dest,
      write: true,
    });
    return;
  }

  if (asset.validate && !asset.validate(argsToPass)) return;

  const additionalTracking = (await asset.execute(argsToPass)) || {};

  trackCommandUsage(
    'create',
    { assetType, ...additionalTracking },
    getAccountId(options)
  );
};

exports.builder = yargs => {
  yargs.positional('type', {
    describe: 'Type of asset',
    type: 'string',
  });
  yargs.positional('name', {
    describe: 'Name of new asset',
    type: 'string',
  });
  yargs.positional('dest', {
    describe:
      'Destination folder for the new asset, relative to your current working directory. If omitted, this argument will default to your current working directory.',
    type: 'string',
  });

  return yargs;
};
