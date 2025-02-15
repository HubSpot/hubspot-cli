// @ts-nocheck
const chalk = require('chalk');
const {
  addAccountOptions,
  addConfigOptions,
  addGlobalOptions,
  addUseEnvironmentOptions,
} = require('../lib/commonOpts');
const { trackCommandUsage } = require('../lib/usageTracking');
const { isPathFolder } = require('../lib/filesystem');

const { logger } = require('@hubspot/local-dev-lib/logger');
const { logError } = require('../lib/errorHandlers/index');
const {
  getDirectoryContentsByPath,
} = require('@hubspot/local-dev-lib/api/fileMapper');
const { HUBSPOT_FOLDER, MARKETPLACE_FOLDER } = require('../lib/constants');
const { i18n } = require('../lib/lang');

const i18nKey = 'commands.list';
const { EXIT_CODES } = require('../lib/enums/exitCodes');

exports.command = 'list [path]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { path, derivedAccountId } = options;
  const directoryPath = path || '/';
  let contentsResp;

  trackCommandUsage('list', null, derivedAccountId);

  logger.debug(
    i18n(`${i18nKey}.gettingPathContents`, {
      path: directoryPath,
    })
  );

  try {
    const { data } = await getDirectoryContentsByPath(
      derivedAccountId,
      directoryPath
    );
    contentsResp = data;
  } catch (e) {
    logError(e);
    process.exit(EXIT_CODES.SUCCESS);
  }

  if (!contentsResp.folder) {
    logger.info(
      i18n(`${i18nKey}.noFilesFoundAtPath`, {
        path: directoryPath,
      })
    );
    return;
  }
  // getDirectoryContentsByPath omits @hubspot
  const contents =
    directoryPath === '/'
      ? ['@hubspot', ...contentsResp.children]
      : contentsResp.children;

  if (contents.length === 0) {
    logger.info(
      i18n(`${i18nKey}.noFilesFoundAtPath`, {
        path: directoryPath,
      })
    );
    return;
  }

  const folderContentsOutput = contents
    .map(addColorToContents)
    .sort(sortContents)
    .join('\n');

  logger.log(folderContentsOutput);
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: i18n(`${i18nKey}.positionals.path.describe`),
    type: 'string',
  });
  yargs.example([['$0 list'], ['$0 list /'], ['$0 list serverless']]);

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);
  addGlobalOptions(yargs);

  return yargs;
};

const addColorToContents = fileOrFolder => {
  if (!isPathFolder(fileOrFolder)) {
    return chalk.reset.cyan(fileOrFolder);
  }
  if (fileOrFolder === HUBSPOT_FOLDER || fileOrFolder === MARKETPLACE_FOLDER) {
    return chalk.reset.bold.blue(fileOrFolder);
  }
  return chalk.reset.blue(fileOrFolder);
};

const sortContents = (a, b) => {
  // Pin @hubspot folder to top
  if (a === HUBSPOT_FOLDER) {
    return -1;
  } else if (b === HUBSPOT_FOLDER) {
    return 1;
  }

  // Pin @marketplace folder to top
  if (a === MARKETPLACE_FOLDER) {
    return -1;
  } else if (b === MARKETPLACE_FOLDER) {
    return 1;
  }

  return a.localeCompare(b);
};
