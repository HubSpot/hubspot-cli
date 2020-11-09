const chalk = require('chalk');
const {
  addAccountOptions,
  addConfigOptions,
  setLogLevel,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../lib/commonOpts');
const { trackCommandUsage } = require('../lib/usageTracking');
const { logDebugInfo } = require('../lib/debugInfo');
const { validateAccount } = require('../lib/validation');
const { isPathFolder } = require('../lib/filesystem');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cms-lib/errorHandlers');
const {
  getDirectoryContentsByPath,
} = require('@hubspot/cms-lib/api/fileMapper');
const {
  HUBSPOT_FOLDER,
  MARKETPLACE_FOLDER,
} = require('@hubspot/cms-lib/lib/constants');

const loadAndValidateOptions = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
};

exports.command = 'list [path]';
exports.describe = 'list remote contents of a directory';

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { path } = options;
  const directoryPath = path || '/';
  const accountId = getAccountId(options);
  let contentsResp;

  trackCommandUsage('list', {}, accountId);

  logger.debug(`Getting contents of ${directoryPath}`);

  try {
    contentsResp = await getDirectoryContentsByPath(accountId, directoryPath);
  } catch (e) {
    logApiErrorInstance(
      accountId,
      e,
      new ApiErrorContext({ accountId, directoryPath })
    );
    process.exit();
  }

  if (contentsResp.children.length) {
    const mappedContents = contentsResp.children.map(fileOrFolder => {
      if (!isPathFolder(fileOrFolder)) {
        return fileOrFolder;
      }

      return chalk.reset.blue(fileOrFolder);
    });
    const hubspotFolder = `/${HUBSPOT_FOLDER}`;
    const marketplaceFolder = `/${MARKETPLACE_FOLDER}`;
    const folderContentsOutput = mappedContents
      .sort(function(a, b) {
        // Pin @hubspot folder to top
        if (a === hubspotFolder) {
          return -1;
        } else if (b === hubspotFolder) {
          return 1;
        }

        // Pin @marketplace folder to top
        if (a === marketplaceFolder) {
          return -1;
        } else if (b === marketplaceFolder) {
          return 1;
        }

        return a.localeCompare(b);
      })
      .join('\n');

    logger.log(folderContentsOutput);
  } else {
    logger.info(`No files found in ${directoryPath}`);
  }
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: 'Remote directory to list contents',
    type: 'string',
  });
  yargs.example([['$0 list'], ['$0 list /'], ['$0 list serverless']]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
