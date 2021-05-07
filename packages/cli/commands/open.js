const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../lib/commonOpts');
const { trackCommandUsage } = require('../lib/usageTracking');
const { logSiteLinks, getSiteLinksAsArray, openLink } = require('../lib/links');
const inquirer = require('inquirer');

const separator = ' => ';
const createListPrompt = async accountId =>
  inquirer.prompt([
    {
      type: 'rawlist',
      look: false,
      name: 'open',
      pageSize: 20,
      message: 'Select a link to open',
      choices: getSiteLinksAsArray(accountId).map(
        l => `${l.shortcut}${separator}${l.url}`
      ),
      filter: val => val.split(separator)[0],
    },
  ]);

exports.command = 'open [shortcut]';
exports.describe =
  'Open a HubSpot page in your browser. Run ‘hs open list’ to see all available shortcuts.';

exports.handler = async options => {
  const { shortcut, list } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('open', { shortcut }, accountId);

  if (shortcut === undefined && !list) {
    const choice = await createListPrompt(accountId);
    openLink(accountId, choice.open);
  } else if (list || shortcut === 'list') {
    logSiteLinks(accountId);
    return;
  } else {
    openLink(accountId, shortcut);
  }
};

exports.builder = yargs => {
  yargs.positional('[shortcut]', {
    describe: "Shortcut of the link you'd like to open",
    type: 'string',
  });

  yargs.option('list', {
    alias: 'l',
    describe: 'List all supported shortcuts',
    type: 'boolean',
  });

  yargs.example([
    ['$0 open'],
    ['$0 open --list'],
    ['$0 open settings'],
    ['$0 open settings/navigation'],
    ['$0 open sn'],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
