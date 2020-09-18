const fs = require('fs');
const path = require('path');
const { version } = require('../../package.json');

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
} = require('../../lib/commonOpts');
const { logDebugInfo } = require('../../lib/debugInfo');
const { validatePortal } = require('../../lib/validation');
const {
  trackCommandUsage,
  addHelpUsageTracking,
} = require('../../lib/usageTracking');

const UPLOAD_COMMAND_NAME = 'filemanager-upload';
const UPLOAD_DESCRIPTION =
  'Upload a folder or file from your computer to the HubSpot File Manager';

const action = async ({ src, dest }, options) => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath);
  checkAndWarnGitInclusion();

  if (!validateConfig() || !(await validatePortal(options))) {
    process.exit(1);
  }

  const portalId = getPortalId(options);
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
    UPLOAD_COMMAND_NAME,
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
      logger.error(`The file "${src}" is being ignored via an .hsignore rule`);
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
        logger.error('Uploading file "%s" to "%s" failed', src, normalizedDest);
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
};

const command = 'upload <src> <dest>';
const describe = UPLOAD_DESCRIPTION;
const handler = async argv => action({ src: argv.src, dest: argv.dest }, argv);
const builder = yargs => {
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);

  yargs.positional('src', {
    describe:
      'Path to the local file, relative to your current working directory',
    type: 'string',
    demand: true,
  });
  yargs.positional('dest', {
    describe: 'Path in HubSpot Design Tools, can be a net new path',
    type: 'string',
    demand: true,
  });
};

const configureCommanderFileManagerUploadCommand = commander => {
  commander
    .version(version)
    .description(UPLOAD_DESCRIPTION)
    .arguments('<src> <dest>')
    .action((src, dest) => action({ src, dest }, commander));

  addConfigOptions(commander);
  addPortalOptions(commander);
  addLoggerOptions(commander);
  addHelpUsageTracking(commander, UPLOAD_COMMAND_NAME);
};

module.exports = {
  UPLOAD_DESCRIPTION,
  // Yargs
  command,
  describe,
  handler,
  builder,
  // Commander
  configureCommanderFileManagerUploadCommand,
};
