import { commands } from '../../lang/en.js';

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
