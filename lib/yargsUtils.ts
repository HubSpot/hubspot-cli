import process from 'process';
import { Argv } from 'yargs';
import {
  addCustomHelpOutput,
  addTestingOptions,
  addAccountOptions,
  addConfigOptions,
  addGlobalOptions,
  addUseEnvironmentOptions,
} from './commonOpts';

// See https://github.com/sindresorhus/has-flag/blob/main/index.js (License: https://github.com/sindresorhus/has-flag/blob/main/license)
export function hasFlag(flag: string, argv = process.argv): boolean {
  const prefix = flag.startsWith('-') ? '' : flag.length === 1 ? '-' : '--';
  const position = argv.indexOf(prefix + flag);
  const terminatorPosition = argv.indexOf('--');
  return (
    position !== -1 &&
    (terminatorPosition === -1 || position < terminatorPosition)
  );
}

export function makeYargsBuilder<T>(
  callback: (yargs: Argv) => Argv<T>,
  command: string | string[],
  describe: string,
  options: {
    useGlobalOptions?: boolean;
    useAccountOptions?: boolean;
    useConfigOptions?: boolean;
    useEnvironmentOptions?: boolean;
    useTestingOptions?: boolean;
  } = {}
): (yargs: Argv) => Promise<Argv<T>> {
  return async function (yargs: Argv): Promise<Argv<T>> {
    if (options.useGlobalOptions) {
      addGlobalOptions(yargs);
    }
    if (options.useAccountOptions) {
      addAccountOptions(yargs);
    }
    if (options.useConfigOptions) {
      addConfigOptions(yargs);
    }
    if (options.useEnvironmentOptions) {
      addUseEnvironmentOptions(yargs);
    }
    if (options.useTestingOptions) {
      addTestingOptions(yargs);
    }

    const result = callback(yargs);

    // Must go last to pick up available options
    await addCustomHelpOutput(result, command, describe);

    return result;
  };
}
