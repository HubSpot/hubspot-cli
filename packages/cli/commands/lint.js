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
} = require('../lib/commonOpts');
const { resolveLocalPath } = require('../lib/filesystem');
const { trackCommandUsage } = require('../lib/usageTracking');
const { loadAndValidateOptions } = require('../lib/validation');
const { EXIT_CODES } = require('../lib/exitCodes');

exports.command = 'lint <path>';
// Hiding since this command is still experimental
exports.describe = null; //'Lint a file or folder for HubL syntax';

exports.handler = async options => {
  const { path: lintPath } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);
  const localPath = resolveLocalPath(lintPath);
  const groupName = `Linting "${localPath}"`;

  trackCommandUsage('lint', {}, accountId);

  logger.group(groupName);
  let count = 0;
  try {
    await lint(accountId, localPath, result => {
      count += printHublValidationResult(result);
    });
  } catch (err) {
    logger.groupEnd(groupName);
    logErrorInstance(err, { accountId });
    process.exit(EXIT_CODES.ERROR);
  }
  logger.groupEnd(groupName);
  logger.log(`${count} issues found`);
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  yargs.positional('path', {
    describe: 'Local folder to lint',
    type: 'string',
  });
  return yargs;
};
