import { Argv } from 'yargs';
import { uiLogger } from './ui/logger.js';
import { uiCommandReference } from './ui/index.js';
import { EXIT_CODES } from './enums/exitCodes.js';
import { YargsCommandModule } from '../types/Yargs.js';

export const commandSuggestionMappings: Record<string, string> = {
  create: 'hs cms app|theme|module|webpack|function|template create',
  fetch: 'hs cms fetch',
  lint: 'hs cms lint',
  list: 'hs cms list',
  mv: 'hs cms mv',
  remove: 'hs cms delete',
  upload: 'hs cms upload',
  watch: 'hs cms watch',

  'function deploy': 'hs cms function deploy',
  'function list': 'hs cms function list',
  'function server': 'hs cms function server',
  logs: 'hs cms function logs',

  'module marketplace-validate': 'hs cms module marketplace-validate',

  'theme generate-selectors': 'hs cms theme generate-selectors',
  'theme marketplace-validate': 'hs cms theme marketplace-validate',
  'theme preview': 'hs cms theme preview',

  'custom-object schema create': 'hs custom-object create-schema',
  'custom-object schema delete': 'hs custom-object delete-schema',
  'custom-object schema fetch-all': 'hs custom-object fetch-all-schemas',
  'custom-object schema fetch': 'hs custom-object fetch-schema',
  'custom-object schema list': 'hs custom-object list-schemas',
  'custom-object schema update': 'hs custom-object update-schema',
};

function createCommandSuggestionHandler(newCommand: string): () => void {
  return () => {
    uiLogger.error(`Did you mean ${uiCommandReference(newCommand)}?`);
    process.exit(EXIT_CODES.ERROR);
  };
}

function createCommandSuggestion(
  oldCommand: string | string[],
  newCommand: string
): YargsCommandModule<unknown, object> {
  return {
    command: oldCommand,
    builder: async (yargs: Argv) => {
      return yargs.strict(false) as Argv<object>;
    },
    handler: createCommandSuggestionHandler(newCommand),
  };
}

export function addCommandSuggestions(yargsInstance: Argv): Argv {
  return Object.entries(commandSuggestionMappings).reduce(
    (yargs, [oldCommand, newCommand]) =>
      yargs.command(createCommandSuggestion(oldCommand, newCommand)),
    yargsInstance
  );
}
