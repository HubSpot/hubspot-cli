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
} = require('../lib/errorHandlers/apiErrors');
const {
  getDirectoryContentsByPath,
} = require('@hubspot/cli-lib/api/fileMapper');
const {
  HUBSPOT_FOLDER,
  MARKETPLACE_FOLDER,
} = require('@hubspot/cli-lib/lib/constants');
const { loadAndValidateOptions } = require('../lib/validation');
const { i18n } = require('../lib/lang');

const i18nKey = 'cli.commands.list';
const { EXIT_CODES } = require('../lib/enums/exitCodes');

exports.command = 'list [path]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { path } = options;
  const directoryPath = path || '/';
  const accountId = getAccountId(options);
  let contentsResp;

  trackCommandUsage('list', null, accountId);

  logger.debug(
    i18n(`${i18nKey}.gettingPathContents`, {
      path: directoryPath,
    })
  );

  try {
    contentsResp = await getDirectoryContentsByPath(accountId, directoryPath);
  } catch (e) {
    logApiErrorInstance(e, new ApiErrorContext({ accountId, directoryPath }));
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

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

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
