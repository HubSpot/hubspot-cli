import { Argv } from 'yargs';
import {
  addCustomHelpOutput,
  addTestingOptions,
  addAccountOptions,
  addConfigOptions,
  addGlobalOptions,
  addUseEnvironmentOptions,
  addCmsPublishModeOptions,
  addJSONOutputOptions,
} from './commonOpts.js';
import { hasFlag } from './utils/hasFlag.js';
import { commands } from '../lang/en.js';

// Re-export for backwards compatibility
export { hasFlag };

export function makeYargsBuilder<T>(
  callback: (yargs: Argv) => Argv<T>,
  command: string | string[],
  describe?: string,
  options: {
    useGlobalOptions?: boolean;
    useAccountOptions?: boolean;
    useConfigOptions?: boolean;
    useEnvironmentOptions?: boolean;
    useTestingOptions?: boolean;
    useCmsPublishModeOptions?: boolean | { read?: boolean; write?: boolean };
    useJSONOutputOptions?: boolean;
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
    if (options.useJSONOutputOptions) {
      addJSONOutputOptions(yargs);
    }
    if (options.useCmsPublishModeOptions) {
      const opts =
        typeof options.useCmsPublishModeOptions === 'object'
          ? options.useCmsPublishModeOptions
          : { write: true };
      addCmsPublishModeOptions(yargs, opts);
    }

    const result = callback(yargs);

    // Must go last to pick up available options
    await addCustomHelpOutput(result, command, describe);

    return result;
  };
}

export function strictEnforceBoolean(
  rawArgs: string[],
  booleanOptions: string[]
) {
  for (const option of booleanOptions) {
    const argIndex = rawArgs.findIndex(arg => arg.startsWith(`--${option}=`));
    if (argIndex !== -1) {
      const value = rawArgs[argIndex].split('=')[1];
      if (value && !['true', 'false'].includes(value.toLowerCase())) {
        throw new Error(
          commands.config.subcommands.set.errors.invalidBoolean(option, value)
        );
      }
    }
  }

  return true;
}
