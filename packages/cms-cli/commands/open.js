const {
  addPortalOptions,
  addConfigOptions,
  getPortalId,
  addUseEnvironmentOptions,
} = require('../lib/commonOpts');
const { trackCommandUsage } = require('../lib/usageTracking');
const { logSiteLinks, getSiteLinks, openLink } = require('../lib/links');

exports.command = 'open [shortcut]';
exports.describe = 'Quickly open a page to HubSpot in your browser';

exports.handler = async options => {
  const { shortcut, list } = options;
  const portalId = getPortalId(options);

  trackCommandUsage('open', { shortcut }, portalId);

  if (shortcut === undefined || list) {
    logSiteLinks(getSiteLinks(portalId));
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
    ['$0 open --list'],
    ['$0 open settings'],
    ['$0 open settings/navigation'],
    ['$0 open sn'],
    ['$0 open 10'],
  ]);

  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
