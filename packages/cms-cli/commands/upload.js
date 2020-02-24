const fs = require('fs');
const path = require('path');
const { version } = require('../package.json');

const {
  loadConfig,
  uploadFolder,
  validateConfig,
} = require('@hubspot/cms-lib');
const {
  getFileMapperApiQueryFromMode,
} = require('@hubspot/cms-lib/fileMapper');
const { upload } = require('@hubspot/cms-lib/api/fileMapper');
const {
  getCwd,
  convertToUnixPath,
  isAllowedExtension,
} = require('@hubspot/cms-lib/path');
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
  addModeOptions,
  setLogLevel,
  getPortalId,
  getMode,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const { validatePortal, validateMode } = require('../lib/validation');
const {
  trackCommandUsage,
  addHelpUsageTracking,
} = require('../lib/usageTracking');

const COMMAND_NAME = 'upload';

function configureUploadCommand(program) {
  program
    .version(version)
    .description(
      'Upload a folder or file from your computer to the HubSpot CMS'
    )
    .arguments('<src> <dest>')
    .action(async (src, dest, command = {}) => {
      setLogLevel(command);
      logDebugInfo(command);
      const { config: configPath } = command;
      loadConfig(configPath);

      if (
        !(
          validateConfig() &&
          (await validatePortal(command)) &&
          validateMode(program)
        )
      ) {
        process.exit(1);
      }

      const portalId = getPortalId(command);
      const mode = getMode(command);
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
        { mode, type: stats.isFile() ? 'file' : 'folder' },
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
        if (!isAllowedExtension(src)) {
          logger.error(`The file "${src}" does not have a valid extension`);
          return;
        }

        if (shouldIgnoreFile(absoluteSrcPath, getCwd())) {
          logger.error(
            `The file "${src}" is being ignored via an .hsignore rule`
          );
          return;
        }

        upload(portalId, absoluteSrcPath, normalizedDest, {
          qs: getFileMapperApiQueryFromMode(mode),
        })
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
          mode,
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
  addModeOptions(program, { write: true });
  addHelpUsageTracking(program, COMMAND_NAME);
}

module.exports = {
  configureUploadCommand,
};
