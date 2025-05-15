import { Argv, ArgumentsCamelCase } from 'yargs';
import { lint } from '@hubspot/local-dev-lib/cms/validate';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  HubLValidationError,
  LintResult,
  Validation,
} from '@hubspot/local-dev-lib/types/HublValidation';
import { logError } from '../lib/errorHandlers/index';
import { trackCommandUsage } from '../lib/usageTracking';
import { i18n } from '../lib/lang';
import { resolveLocalPath } from '../lib/filesystem';
import { EXIT_CODES } from '../lib/enums/exitCodes';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  YargsCommandModule,
} from '../types/Yargs';
import { makeYargsBuilder } from '../lib/yargsUtils';

const command = 'lint <path>';
// Hiding since this command is still experimental
const describe = undefined; //'Lint a file or folder for HubL syntax';

function getErrorsFromHublValidationObject(
  validation: Validation
): Array<HubLValidationError> {
  return (
    (validation && validation.meta && validation.meta.template_errors) || []
  );
}

function printHublValidationError(err: HubLValidationError): void {
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

type LintArgs = CommonArgs & ConfigArgs & AccountArgs & { path: string };

async function handler(args: ArgumentsCamelCase<LintArgs>): Promise<void> {
  const { path: lintPath, derivedAccountId } = args;

  const localPath = resolveLocalPath(lintPath);
  const groupName = i18n(`commands.lint.groupName`, {
    path: localPath,
  });

  trackCommandUsage('lint', undefined, derivedAccountId);

  logger.group(groupName);
  let count = 0;
  try {
    await lint(derivedAccountId, localPath, (result: LintResult) => {
      return (count += printHublValidationResult(result));
    });
  } catch (err) {
    logger.groupEnd();
    logError(err, { accountId: derivedAccountId });
    process.exit(EXIT_CODES.ERROR);
  }
  logger.groupEnd();
  logger.log(
    i18n(`commands.lint.issuesFound`, {
      count,
    })
  );
}

function lintBuilder(yargs: Argv): Argv<LintArgs> {
  yargs.positional('path', {
    describe: i18n(`commands.lint.positionals.path.describe`),
    required: true,
    type: 'string',
  });

  return yargs as Argv<LintArgs>;
}

const builder = makeYargsBuilder<LintArgs>(lintBuilder, command, describe, {
  useGlobalOptions: true,
  useConfigOptions: true,
  useAccountOptions: true,
});

const lintCommand: YargsCommandModule<unknown, LintArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default lintCommand;

// TODO Remove this after cli.ts is ported to TS
module.exports = lintCommand;
