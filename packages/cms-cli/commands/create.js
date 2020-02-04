const path = require('path');
const fs = require('fs-extra');
const { version } = require('../package.json');

const {
  logFileSystemErrorInstance,
} = require('@hubspot/cms-lib/errorHandlers');
const { logger } = require('@hubspot/cms-lib/logger');
const { createTheme } = require('@hubspot/cms-lib/themes');

const { addLoggerOptions, setLogLevel } = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const { resolveLocalPath } = require('../lib/filesystem');
const {
  trackCommandUsage,
  addHelpUsageTracking,
} = require('../lib/usageTracking');

const COMMAND_NAME = 'create';

const TYPES = {
  module: 'module',
  template: 'template',
  'website-theme': 'website-theme',
};

const ASSET_PATHS = {
  [TYPES.module]: path.resolve(__dirname, '../defaults/Sample.module'),
  [TYPES.template]: path.resolve(__dirname, '../defaults/template.html'),
};

const createModule = (name, dest) => {
  const assetPath = ASSET_PATHS.module;
  const folderName = name.endsWith('.module') ? name : `${name}.module`;
  const destPath = path.join(dest, folderName);
  if (fs.existsSync(destPath)) {
    logger.error(`The ${destPath} path already exists`);
    return;
  }
  logger.log(`Creating ${destPath}`);
  fs.mkdirp(destPath);
  logger.log(`Copying sample module files to ${destPath}`);
  fs.copySync(assetPath, destPath);
};

const createTemplate = (name, dest) => {
  const assetPath = ASSET_PATHS.template;
  const filename = name.endsWith('.html') ? name : `${name}.html`;
  const filePath = path.join(dest, filename);
  if (fs.existsSync(filePath)) {
    logger.error(`The ${filePath} path already exists`);
    return;
  }
  logger.log(`Making ${dest} if needed`);
  fs.mkdirp(dest);
  logger.log(`Copying boilerplate template to ${filePath}`);
  fs.copySync(assetPath, filePath);
};

function configureCreateCommand(program) {
  program
    .version(version)
    .description('Create assets from boilerplate.')
    // For a theme this is `website-theme <dest>`
    // TODO: Yargs allows an array of commands.
    .arguments('<type> <name> [dest]')
    .option(
      '--theme-version <theme-version>',
      'Theme boilerplate version to use',
      ''
    )
    .action(async (type, name, dest) => {
      setLogLevel(program);
      logDebugInfo(program);
      type = typeof type === 'string' && type.toLowerCase();
      if (!type || !TYPES[type]) {
        logger.error(`The asset type ${type} is not supported`);
        return;
      }

      // TODO: In yargs use `.implies()`
      if (type === TYPES['website-theme']) {
        dest = name;
      }

      dest = resolveLocalPath(dest);

      try {
        await fs.ensureDir(dest);
      } catch (e) {
        logger.error(`The "${dest}" is not a usable path to a directory`);
        logFileSystemErrorInstance(e, {
          filepath: dest,
          write: true,
        });
      }

      trackCommandUsage(COMMAND_NAME, { assetType: type });

      switch (type) {
        case TYPES.module:
          createModule(name, dest);
          break;
        case TYPES.template:
          createTemplate(name, dest);
          break;
        case TYPES['website-theme']:
          createTheme(dest, type, program);
          break;
        default:
          break;
      }
    });

  addLoggerOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
}

module.exports = {
  configureCreateCommand,
};
