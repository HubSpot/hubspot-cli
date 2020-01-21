const fs = require('fs');
const path = require('path');

const { loadConfig, uploadFolder } = require('@hubspot/cms-lib');
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
  addModeOptions,
  getPortalId,
  getMode,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const {
  validateConfig,
  validatePortal,
  validateMode,
} = require('../lib/validation');

const COMMAND_NAME = 'upload';

const validateInputs = async argv => {
  let portalId;
  let mode;
  let src;
  let dest;
  try {
    loadConfig(argv.config);
    portalId = getPortalId(argv);
    mode = getMode(argv);
    src = path.resolve(getCwd(), argv.src);
    dest = convertToUnixPath(argv.dest);
  } catch (e) {
    // noop
  }
  const resultArgs = { ...argv, src, dest, portalId, mode };
  if (
    typeof src !== 'string' ||
    typeof dest !== 'string' ||
    !validateConfig() ||
    !validateMode(resultArgs) ||
    !(await validatePortal(resultArgs))
  ) {
    // Required missing positionals will be logged by yargs
    process.exit(1);
  }
  return resultArgs;
};

const validateSrcAndDest = async argv => {
  const { src, dest } = argv;
  let isValidSrc = true;
  let isFile = false;
  let isFolder = false;
  let stats;
  try {
    stats = fs.statSync(src);
    [isFile, isFolder] = [stats.isFile(), stats.isDirectory()];
    // if (!stats.isFile() && !stats.isDirectory()) {
    if (!isFile && !isFolder) {
      isValidSrc = false;
    }
  } catch (e) {
    isValidSrc = false;
  }
  if (!isValidSrc) {
    logger.error(`The path "${src}" is not a path to a file or folder`);
    process.exit(1);
  }
  if (!dest) {
    logger.error('A destination path needs to be passed');
    process.exit(1);
  }
  const srcDestIssues = await validateSrcAndDestPaths(
    { isLocal: true, path: src },
    { isHubSpot: true, path: dest }
  );
  if (srcDestIssues.length) {
    srcDestIssues.forEach(({ message }) => logger.error(message));
    process.exit(1);
  }
  return {
    isFile,
    isFolder,
    type: isFile ? 'file' : 'folder',
  };
};

const validateFileUpload = async argv => {
  const { isFile, src } = argv;
  if (isFile) {
    if (shouldIgnoreFile(src, getCwd())) {
      logger.error(`The file "${src}" is being ignored via an .hsignore rule`);
      process.exit(1);
    }
    if (!isAllowedExtension(src)) {
      logger.error(`The file "${src}" does not have a valid extension`);
      process.exit(1);
    }
  }
  return {};
};

/*
 * Module
 */

exports.command = `${COMMAND_NAME} <src> <dest>`;

exports.describe =
  'Upload a folder or file from your computer to the HubSpot CMS';

exports.builder = yargs => {
  yargs
    .positional('src', {
      describe: 'Local filesystem path',
      type: 'string',
    })
    .positional('dest', {
      describe: 'Remote hubspot path',
      type: 'string',
    })
    .middleware([
      logDebugInfo,
      validateInputs,
      validateSrcAndDest,
      validateFileUpload,
    ]);
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);
  addModeOptions(yargs, true);
  return yargs;
};

exports.handler = argv => {
  const { isFile, isFolder, portalId, src, dest, mode } = argv;
  if (isFile) {
    upload(portalId, src, dest, {
      qs: getFileMapperApiQueryFromMode(mode),
    })
      .then(() => {
        logger.log('Uploaded file "%s" to "%s"', src, dest);
      })
      .catch(error => {
        logger.error('Uploading file "%s" to "%s" failed', src, dest);
        logApiUploadErrorInstance(
          error,
          new ApiErrorContext({
            portalId,
            request: dest,
            payload: src,
          })
        );
      });
  } else if (isFolder) {
    logger.log(`Uploading files from ${src} to ${dest} in portal ${portalId}`);
    uploadFolder(portalId, src, dest, {
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
  return {
    COMMAND_NAME,
    argv,
  };
};
