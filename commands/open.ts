import { Argv, ArgumentsCamelCase } from 'yargs';
import { trackCommandUsage } from '../lib/usageTracking.js';
import { logSiteLinks, getSiteLinksAsArray, openLink } from '../lib/links.js';
import { promptUser } from '../lib/prompts/promptUtils.js';
import { commands } from '../lang/en.js';
import { EXIT_CODES } from '../lib/enums/exitCodes.js';
import {
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  AccountArgs,
  YargsCommandModule,
} from '../types/Yargs.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';

const separator = ' => ';

async function createListPrompt(accountId: number): Promise<{ open: string }> {
  return promptUser({
    name: 'open',
    type: 'rawlist',
    pageSize: 20,
    message: commands.open.selectLink,
    choices: getSiteLinksAsArray(accountId)
      .filter(l => !!l.url)
      .map(l => ({
        name: `${l.shortcut}${separator}${l.url}`,
        value: l.shortcut,
      })),
  });
}

const command = 'open [shortcut]';
const describe = commands.open.describe;

type OpenArgs = CommonArgs &
  ConfigArgs &
  EnvironmentArgs &
  AccountArgs & {
    shortcut?: string;
    list?: boolean;
  };

async function handler(args: ArgumentsCamelCase<OpenArgs>): Promise<void> {
  const { shortcut, list, derivedAccountId } = args;

  trackCommandUsage('open', undefined, derivedAccountId);

  if (shortcut === undefined && !list) {
    const { open } = await createListPrompt(derivedAccountId);
    openLink(derivedAccountId, open);
  } else if (list) {
    logSiteLinks(derivedAccountId);
  } else if (shortcut) {
    openLink(derivedAccountId, shortcut);
  }
  process.exit(EXIT_CODES.SUCCESS);
}

function openBuilder(yargs: Argv): Argv<OpenArgs> {
  yargs.positional('[shortcut]', {
    describe: commands.open.positionals.shortcut.describe,
    type: 'string',
  });

  yargs.option('list', {
    alias: 'l',
    describe: commands.open.options.list.describe,
    type: 'boolean',
  });

  yargs.example([
    ['$0 open'],
    ['$0 open --list'],
    ['$0 open settings'],
    ['$0 open settings/navigation'],
    ['$0 open sn'],
  ]);

  return yargs as Argv<OpenArgs>;
}

const builder = makeYargsBuilder<OpenArgs>(openBuilder, command, describe, {
  useGlobalOptions: true,
  useConfigOptions: true,
  useAccountOptions: true,
  useEnvironmentOptions: true,
});

const openCommand: YargsCommandModule<unknown, OpenArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default openCommand;
