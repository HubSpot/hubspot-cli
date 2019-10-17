const path = require('path');
const fs = require('fs-extra');
const { version } = require('../package.json');

const { logger } = require('@hubspot/cms-lib/logger');
const { getCwd } = require('@hubspot/cms-lib/path');

const { addLoggerOptions, setLogLevel } = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const {
  trackCommandUsage,
  addHelpUsageTracking,
} = require('../lib/usageTracking');

const COMMAND_NAME = 'create';

const ASSET_PATHS = {
  module: path.resolve(__dirname, '../defaults/Sample.module'),
  template: path.resolve(__dirname, '../defaults/template.html'),
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
    .arguments('<type> <name> [dest]')
    .action((type, name, dest, options = {}) => {
      setLogLevel(options);
      logDebugInfo(options);
      const assetPath = ASSET_PATHS[type];
      if (!assetPath) {
        logger.error(`The asset type ${type} is not supported`);
        return;
      }

      // For some reason, when `dest` is not passed from the CLI, commander passes `program`
      const destPath =
        !dest || typeof dest === 'object'
          ? getCwd()
          : path.resolve(getCwd(), dest);

      try {
        const stats = fs.statSync(destPath);
        if (!stats.isDirectory()) {
          logger.error(`The "${dest}" is not a path to a directory`);
          return;
        }
      } catch (e) {
        logger.error(`The "${dest}" is not a path to a directory`);
        return;
      }

      trackCommandUsage(COMMAND_NAME, { assetType: type });

      switch (type) {
        case 'module':
          createModule(name, destPath);
          break;
        case 'template':
          createTemplate(name, destPath);
          break;
        default:
      }
    });

  addLoggerOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
}

module.exports = {
  configureCreateCommand,
};
