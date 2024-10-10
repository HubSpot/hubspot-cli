const { lint } = require('@hubspot/local-dev-lib/cms/validate');
const { printHublValidationResult } = require('../lib/hublValidate');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { logErrorInstance } = require('../lib/errorHandlers/standardErrors');

const { addConfigOptions, addAccountOptions } = require('../lib/commonOpts');
const { resolveLocalPath } = require('../lib/filesystem');
const { trackCommandUsage } = require('../lib/usageTracking');
const { loadAndValidateOptions } = require('../lib/validation');
const { i18n } = require('../lib/lang');

const i18nKey = 'commands.lint';
const { EXIT_CODES } = require('../lib/enums/exitCodes');

exports.command = 'lint <path>';
// Hiding since this command is still experimental
exports.describe = null; //'Lint a file or folder for HubL syntax';

exports.handler = async options => {
  const { path: lintPath } = options;

  await loadAndValidateOptions(options);

  const { account } = options;
  const localPath = resolveLocalPath(lintPath);
  const groupName = i18n(`${i18nKey}.groupName`, {
    path: localPath,
  });

  trackCommandUsage('lint', null, account);

  logger.group(groupName);
  let count = 0;
  try {
    await lint(account, localPath, result => {
      count += printHublValidationResult(result);
    });
  } catch (err) {
    logger.groupEnd(groupName);
    logErrorInstance(err, { account });
    process.exit(EXIT_CODES.ERROR);
  }
  logger.groupEnd(groupName);
  logger.log(
    i18n(`${i18nKey}.issuesFound`, {
      count,
    })
  );
};

exports.builder = yargs => {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  yargs.positional('path', {
    describe: i18n(`${i18nKey}.positionals.path.describe`),
    type: 'string',
  });
  return yargs;
};
