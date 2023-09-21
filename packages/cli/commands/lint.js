const {
  lint,
  printHublValidationResult,
} = require('@hubspot/cli-lib/validate');
const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');

const {
  addConfigOptions,
  addAccountOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../lib/commonOpts');
const { resolveLocalPath } = require('../lib/filesystem');
const { trackCommandUsage } = require('../lib/usageTracking');
const { loadAndValidateOptions } = require('../lib/validation');
const { i18n } = require('../lib/lang');

const i18nKey = 'cli.commands.lint';
const { EXIT_CODES } = require('../lib/enums/exitCodes');

exports.command = 'lint <path>';
exports.describe = 'Lint a file or folder for HubL errors and warnings';

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { path: lintPath } = options;
  const accountId = getAccountId(options);
  const localPath = resolveLocalPath(lintPath);

  trackCommandUsage('lint', null, accountId);

  const groupName = i18n(`${i18nKey}.groupName`, {
    path: localPath,
  });
  let errorCount = 0;

  logger.group(groupName);

  try {
    await lint(accountId, localPath, result => {
      errorCount = printHublValidationResult(result);
    });
  } catch (err) {
    logErrorInstance(err, { accountId });
    process.exit(EXIT_CODES.ERROR);
  }

  logger.groupEnd();
  errorCount === 0
    ? logger.log(i18n(`${i18nKey}.noIssuesFound`))
    : logger.log(
        i18n(`${i18nKey}.issuesFound`, {
          errorCount,
        })
      );
};

exports.builder = yargs => {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);
  yargs.positional('path', {
    describe: i18n(`${i18nKey}.positionals.path.describe`),
    type: 'string',
  });
  return yargs;
};
