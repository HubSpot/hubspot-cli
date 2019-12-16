const fs = require('fs');
const path = require('path');
const { version } = require('../package.json');

const { loadConfig } = require('@hubspot/cms-lib');
const { uploadFolder } = require('@hubspot/cms-lib/fileManager');
const { uploadFile } = require('@hubspot/cms-lib/api/fileManager');
const { getCwd, convertToUnixPath } = require('@hubspot/cms-lib/path');
const { logger } = require('@hubspot/cms-lib/logger');
const {
  logErrorInstance,
  ApiErrorContext,
  logApiUploadErrorInstance,
} = require('@hubspot/cms-lib/errorHandlers');
const { validateSrcAndDestPaths } = require('@hubspot/cms-lib/modules');
const { shouldIgnoreFile } = require('@hubspot/cms-lib/ignoreRules');

const {
  addConfigOptions,
  addPortalOptions,
  addLoggerOptions,
  setLogLevel,
  getPortalId,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const { validateConfig, validatePortal } = require('../lib/validation');
const {
  trackCommandUsage,
  addHelpUsageTracking,
} = require('../lib/usageTracking');

const COMMAND_NAME = 'upload';

function configureFileManagerCommand(program) {
  program
    .version(version)
    .description('Commands for working with the File Manager')
    .command('upload <src> <dest>', 'upload files to the file manager');

  addLoggerOptions(program);
  addHelpUsageTracking(program);
}

function configureFileManagerUploadCommand(program) {
  program
    .version(version)
    .description(
      'Upload a folder or file from your computer to the HubSpot File Manager'
    )
    .arguments('<src> <dest>')
    .action(async (src, dest, command = {}) => {
      setLogLevel(command);
      logDebugInfo(command);
      const { config: configPath } = command;
      loadConfig(configPath);

      if (!validateConfig() || !(await validatePortal(command))) {
        process.exit(1);
      }

      const portalId = getPortalId(command);
      const absoluteSrcPath = path.resolve(getCwd(), src);

      let stats;
      try {
        stats = fs.statSync(absoluteSrcPath);
        if (!stats.isFile() && !stats.isDirectory()) {
          logger.error(`The path "${src}" is not a path to a file or folder`);
          return;
        }
      } catch (e) {
        logger.error(`The path "${src}" is not a path to a file or folder`);
        return;
      }

      if (!dest) {
        logger.error('A destination path needs to be passed');
        return;
      }
      const normalizedDest = convertToUnixPath(dest);
      trackCommandUsage(
        COMMAND_NAME,
        { type: stats.isFile() ? 'file' : 'folder' },
        portalId
      );

      const srcDestIssues = await validateSrcAndDestPaths(
        { isLocal: true, path: src },
        { isHubSpot: true, path: dest }
      );
      if (srcDestIssues.length) {
        srcDestIssues.forEach(({ message }) => logger.error(message));
        process.exit(1);
      }

      if (stats.isFile()) {
        if (shouldIgnoreFile(absoluteSrcPath, getCwd())) {
          logger.error(
            `The file "${src}" is being ignored via an .hsignore rule`
          );
          return;
        }

        uploadFile(portalId, absoluteSrcPath, normalizedDest)
          .then(() => {
            logger.log('Uploaded file "%s" to "%s"', src, normalizedDest);
          })
          .catch(error => {
            logger.error(
              'Uploading file "%s" to "%s" failed',
              src,
              normalizedDest
            );
            logApiUploadErrorInstance(
              error,
              new ApiErrorContext({
                portalId,
                request: normalizedDest,
                payload: src,
              })
            );
          });
      } else {
        logger.log(
          `Uploading files from ${src} to ${dest} in portal ${portalId}`
        );
        uploadFolder(portalId, absoluteSrcPath, dest, {
          cwd: getCwd(),
        })
          .then(() => {
            logger.log(`Uploading files to ${dest} is complete`);
          })
          .catch(error => {
            logger.error('Uploading failed');
            logErrorInstance(error, {
              portalId,
            });
          });
      }
    });

  addConfigOptions(program);
  addPortalOptions(program);
  addLoggerOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
}

module.exports = {
  configureFileManagerUploadCommand,
  configureFileManagerCommand,
};
