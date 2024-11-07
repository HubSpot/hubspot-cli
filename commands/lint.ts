// @ts-nocheck
const { lint } = require('@hubspot/local-dev-lib/cms/validate');
const { logger } = require('@hubspot/local-dev-lib/logger');
import {
  HubLValidationError,
  LintResult,
  Validation,
} from '@hubspot/local-dev-lib/types/HublValidation';
const { logError } = require('../lib/errorHandlers/index');
const {
  addConfigOptions,
  addAccountOptions,
  getAccountId,
} = require('../lib/commonOpts');
const { resolveLocalPath } = require('../lib/filesystem');
const { trackCommandUsage } = require('../lib/usageTracking');
const { loadAndValidateOptions } = require('../lib/validation');
const { i18n } = require('../lib/lang');

const i18nKey = 'commands.lint';
const { EXIT_CODES } = require('../lib/enums/exitCodes');

exports.command = 'lint <path>';
// Hiding since this command is still experimental
exports.describe = null; //'Lint a file or folder for HubL syntax';

function getErrorsFromHublValidationObject(
  validation: Validation
): Array<HubLValidationError> {
  return (
    (validation && validation.meta && validation.meta.template_errors) || []
  );
}

function printHublValidationError(err: HubLValidationError) {
  const { severity, message, lineno, startPosition } = err;
  const method = severity === 'FATAL' ? 'error' : 'warn';
  logger[method]('[%d, %d]: %s', lineno, startPosition, message);
}

function printHublValidationResult({ file, validation }: LintResult): number {
  let count = 0;

  if (!validation) {
    return count;
  }

  const errors = getErrorsFromHublValidationObject(validation);
  if (!errors.length) {
    return count;
  }
  logger.group(file);
  errors.forEach(err => {
    if (err.reason !== 'SYNTAX_ERROR') {
      return;
    }
    ++count;
    printHublValidationError(err);
  });
  logger.groupEnd();
  return count;
}

exports.handler = async options => {
  const { path: lintPath } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);
  const localPath = resolveLocalPath(lintPath);
  const groupName = i18n(`${i18nKey}.groupName`, {
    path: localPath,
  });

  trackCommandUsage('lint', null, accountId);

  logger.group(groupName);
  let count = 0;
  try {
    await lint(accountId, localPath, result => {
      count += printHublValidationResult(result);
    });
  } catch (err) {
    logger.groupEnd(groupName);
    logError(err, { accountId });
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
