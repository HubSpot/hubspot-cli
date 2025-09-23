import { Argv, ArgumentsCamelCase } from 'yargs';
import { lint } from '@hubspot/local-dev-lib/cms/validate';
import {
  HubLValidationError,
  LintResult,
  Validation,
} from '@hubspot/local-dev-lib/types/HublValidation';
import { logError } from '../lib/errorHandlers/index.js';
import { trackCommandUsage } from '../lib/usageTracking.js';
import { commands } from '../lang/en.js';
import { resolveLocalPath } from '../lib/filesystem.js';
import { EXIT_CODES } from '../lib/enums/exitCodes.js';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  YargsCommandModule,
} from '../types/Yargs.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { uiLogger } from '../lib/ui/logger.js';

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
  if (severity === 'FATAL') {
    uiLogger.error(`[${lineno}, ${startPosition}]: ${message}`);
  } else {
    uiLogger.warn(`[${lineno}, ${startPosition}]: ${message}`);
  }
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
  uiLogger.group(file);
  errors.forEach(err => {
    if (err.reason !== 'SYNTAX_ERROR') {
      return;
    }
    ++count;
    printHublValidationError(err);
  });
  uiLogger.groupEnd();
  return count;
}

type LintArgs = CommonArgs & ConfigArgs & AccountArgs & { path: string };

async function handler(args: ArgumentsCamelCase<LintArgs>): Promise<void> {
  const { path: lintPath, derivedAccountId } = args;

  const localPath = resolveLocalPath(lintPath);
  const groupName = commands.lint.groupName(localPath);

  trackCommandUsage('lint', undefined, derivedAccountId);

  uiLogger.group(groupName);
  let count = 0;
  try {
    await lint(derivedAccountId, localPath, (result: LintResult) => {
      return (count += printHublValidationResult(result));
    });
  } catch (err) {
    uiLogger.groupEnd();
    logError(err, { accountId: derivedAccountId });
    process.exit(EXIT_CODES.ERROR);
  }
  uiLogger.groupEnd();
  uiLogger.log(commands.lint.issuesFound(count));
}

function lintBuilder(yargs: Argv): Argv<LintArgs> {
  yargs.positional('path', {
    describe: commands.lint.positionals.path.describe,
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
