const chalk = require('chalk');
const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../lib/commonOpts');
const { trackCommandUsage } = require('../lib/usageTracking');
const { isPathFolder } = require('../lib/filesystem');

const { logger } = require('@hubspot/cli-lib/logger');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const {
  getDirectoryContentsByPath,
} = require('@hubspot/cli-lib/api/fileMapper');
const {
  HUBSPOT_FOLDER,
  MARKETPLACE_FOLDER,
} = require('@hubspot/cli-lib/lib/constants');
const { loadAndValidateOptions } = require('../lib/validation');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.list';

exports.command = 'list [path]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { path } = options;
  const directoryPath = path || '/';
  const accountId = getAccountId(options);
  let contentsResp;

  trackCommandUsage('list', {}, accountId);

  logger.debug(
    i18n(`${i18nKey}.gettingPathContents`, {
      path: directoryPath,
    })
  );

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
    logger.info(
      i18n(`${i18nKey}.noFilesFoundInPath`, {
        path: directoryPath,
      })
    );
  }
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: i18n(`${i18nKey}.positionals.path.describe`),
    type: 'string',
  });
  yargs.example([['$0 list'], ['$0 list /'], ['$0 list serverless']]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
