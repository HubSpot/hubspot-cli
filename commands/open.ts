// @ts-nocheck
import { EXIT_CODES } from '../lib/enums/exitCodes';
const {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
  addGlobalOptions,
} = require('../lib/commonOpts');
const { trackCommandUsage } = require('../lib/usageTracking');
const { logSiteLinks, getSiteLinksAsArray, openLink } = require('../lib/links');
const { promptUser } = require('../lib/prompts/promptUtils');
const { i18n } = require('../lib/lang');

const i18nKey = 'commands.open';

const separator = ' => ';
const createListPrompt = async accountId =>
  promptUser([
    {
      type: 'rawlist',
      look: false,
      name: 'open',
      pageSize: 20,
      message: i18n(`${i18nKey}.selectLink`),
      choices: getSiteLinksAsArray(accountId).map(
        l => `${l.shortcut}${separator}${l.url}`
      ),
      filter: val => val.split(separator)[0],
    },
  ]);

exports.command = 'open [shortcut]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { shortcut, list, derivedAccountId } = options;

  trackCommandUsage('open', null, derivedAccountId);

  if (shortcut === undefined && !list) {
    const choice = await createListPrompt(derivedAccountId);
    openLink(derivedAccountId, choice.open);
  } else if (list) {
    logSiteLinks(derivedAccountId);
  } else {
    openLink(derivedAccountId, shortcut);
  }
  process.exit(EXIT_CODES.SUCCESS);
};

exports.builder = yargs => {
  yargs.positional('[shortcut]', {
    describe: i18n(`${i18nKey}.positionals.shortcut.describe`),
    type: 'string',
  });

  yargs.option('list', {
    alias: 'l',
    describe: i18n(`${i18nKey}.options.list.describe`),
    type: 'boolean',
  });

  yargs.example([
    ['$0 open'],
    ['$0 open --list'],
    ['$0 open settings'],
    ['$0 open settings/navigation'],
    ['$0 open sn'],
  ]);

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);
  addGlobalOptions(yargs);

  return yargs;
};
