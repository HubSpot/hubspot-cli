const fs = require('fs');
const path = require('path');
const { version } = require('../package.json');

const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
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
  getMode,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const { validatePortal } = require('../lib/validation');
const { resolveLocalPath } = require('../lib/filesystem');
const {
  trackCommandUsage,
  addHelpUsageTracking,
} = require('../lib/usageTracking');

const COMMAND_NAME = 'filemanager-upload';

function configureFileManagerCommand(program) {
  program
    .version(version)
    .description('Commands for working with the File Manager')
    .command('fetch <src> <dest>', 'download files from the file manager')
    .command('upload <src> <dest>', 'upload files to the file manager');

  addLoggerOptions(program);
  addHelpUsageTracking(program);
}

function configureFileManagerFetchCommand(program) {
  program
    .version(version)
    .description(
      'Download a folder or file from the HubSpot File Manager to your computer'
    )
    .arguments('<src> [dest]')
    .action(async (src, dest) => {
      setLogLevel(program);
      logDebugInfo(program);

      const { config: configPath } = program;
      loadConfig(configPath);
      checkAndWarnGitInclusion();

      if (!validateConfig() || !(await validatePortal(program))) {
        process.exit(1);
      }

      if (typeof src !== 'string') {
        logger.error('A source to fetch is required');
        process.exit(1);
      }

      dest = resolveLocalPath(dest);

      const portalId = getPortalId(program);
      const mode = getMode(program);

      trackCommandUsage(COMMAND_NAME, { mode }, portalId);

      // Fetch and write file/folder.
      console.log(dest);
      // downloadFileOrFolder({ portalId, src, dest, mode, options: program });
    });

  addConfigOptions(program);
  addPortalOptions(program);
  addLoggerOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
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
      checkAndWarnGitInclusion();

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
            logger.success(
              'Uploaded file from "%s" to "%s" in the File Manager of portal %s',
              src,
              normalizedDest,
              portalId
            );
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
          `Uploading files from "${src}" to "${dest}" in the File Manager of portal ${portalId}`
        );
        uploadFolder(portalId, absoluteSrcPath, dest, {
          cwd: getCwd(),
        })
          .then(() => {
            logger.success(
              `Uploading files to "${dest}" in the File Manager is complete`
            );
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
  configureFileManagerFetchCommand,
  configureFileManagerUploadCommand,
  configureFileManagerCommand,
};
