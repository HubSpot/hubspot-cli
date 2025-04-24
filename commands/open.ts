import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
  addGlobalOptions,
} from '../lib/commonOpts';
import { trackCommandUsage } from '../lib/usageTracking';
import { logSiteLinks, getSiteLinksAsArray, openLink } from '../lib/links';
import { promptUser } from '../lib/prompts/promptUtils';
import { i18n } from '../lib/lang';
import { EXIT_CODES } from '../lib/enums/exitCodes';
import {
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  AccountArgs,
} from '../types/Yargs';

const separator = ' => ';

async function createListPrompt(accountId: number): Promise<{ open: string }> {
  return promptUser([
    {
      type: 'rawlist',
      name: 'open',
      pageSize: 20,
      message: i18n('commands.open.selectLink'),
      choices: getSiteLinksAsArray(accountId).map(
        l => `${l.shortcut}${separator}${l.url}`
      ),
      filter: val => val.split(separator)[0],
    },
  ]);
}

export const command = 'open [shortcut]';
export const describe = i18n('commands.open.describe');

type OpenArgs = CommonArgs &
  ConfigArgs &
  EnvironmentArgs &
  AccountArgs & {
    shortcut?: string;
    list?: boolean;
  };

export async function handler(
  args: ArgumentsCamelCase<OpenArgs>
): Promise<void> {
  const { shortcut, list, derivedAccountId } = args;

  trackCommandUsage('open', undefined, derivedAccountId);

  if (shortcut === undefined && !list) {
    const choice = await createListPrompt(derivedAccountId);
    openLink(derivedAccountId, choice.open);
  } else if (list) {
    logSiteLinks(derivedAccountId);
  } else if (shortcut) {
    openLink(derivedAccountId, shortcut);
  }
  process.exit(EXIT_CODES.SUCCESS);
}

export function builder(yargs: Argv) {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);
  addGlobalOptions(yargs);

  yargs.positional('[shortcut]', {
    describe: i18n('commands.open.positionals.shortcut.describe'),
    type: 'string',
  });

  yargs.option('list', {
    alias: 'l',
    describe: i18n('commands.open.options.list.describe'),
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
