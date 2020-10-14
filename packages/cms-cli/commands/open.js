const {
  addPortalOptions,
  addConfigOptions,
  getPortalId,
  addUseEnvironmentOptions,
} = require('../lib/commonOpts');
const { trackCommandUsage } = require('../lib/usageTracking');
const { logSiteLinks, getSiteLinksAsArray, openLink } = require('../lib/links');
const inquirer = require('inquirer');

const separator = ' => ';
const createListPrompt = async portalId =>
  inquirer.prompt([
    {
      type: 'rawlist',
      look: false,
      name: 'open',
      pageSize: 20,
      message: 'Select a link to open',
      choices: getSiteLinksAsArray(portalId).map(
        l => `${l.shortcut}${separator}${l.url}`
      ),
      filter: val => val.split(separator)[0],
    },
  ]);

exports.command = 'open [shortcut]';
exports.describe = 'Quickly open a page to HubSpot in your browser';

exports.handler = async options => {
  const { shortcut, list } = options;
  const portalId = getPortalId(options);

  trackCommandUsage('open', { shortcut }, portalId);

  if (shortcut === undefined && !list) {
    const choice = await createListPrompt(portalId);
    openLink(portalId, choice.open);
  } else if (list) {
    logSiteLinks(portalId);
    return;
  } else {
    openLink(portalId, shortcut);
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
  addPortalOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
