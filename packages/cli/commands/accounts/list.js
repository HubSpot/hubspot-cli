const { logger } = require('@hubspot/cli-lib/logger');
const { getConfig, getConfigPath } = require('@hubspot/cli-lib/lib/config');
const {
  getTableContents,
  getTableHeader,
} = require('@hubspot/cli-lib/lib/table');

const {
  addConfigOptions,
  addAccountOptions,
  getAccountId,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.accounts.subcommands.list';

exports.command = 'list';
exports.describe = i18n(`${i18nKey}.describe`);

const sortAndMapPortals = portals => {
  const mappedPortalData = {};
  portals
    .sort((a, b) => {
      if (a.sandboxType === null && b.sandboxType !== null) {
        return -1;
      }
      if (a.sandboxType !== null && b.sandboxType === null) {
        return 1;
      }
      return 0;
    })
    .forEach(portal => {
      if (portal.sandboxType === null) {
        mappedPortalData[portal.portalId] = [portal];
      } else if (portal.sandboxType && portal.parentAccountId) {
        mappedPortalData[portal.parentAccountId] = [
          ...(mappedPortalData[portal.parentAccountId] || []),
          portal,
        ];
      }
    });
  return mappedPortalData;
};

const getPortalData = mappedPortalData => {
  const portalData = [];
  Object.values(mappedPortalData).forEach(set => {
    set.forEach((portal, i) => {
      if (i === 0) {
        portalData.push([portal.name, portal.portalId, portal.authType]);
      } else {
        portalData.push([
          `↳ ${portal.name} [sandbox]`,
          portal.portalId,
          portal.authType,
        ]);
      }
    });
  });
  return portalData;
};

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('accounts-list', {}, accountId);

  const config = getConfig();
  const configPath = getConfigPath();
  const mappedPortalData = sortAndMapPortals(config.portals);
  const portalData = getPortalData(mappedPortalData);
  portalData.unshift(
    getTableHeader([
      i18n(`${i18nKey}.labels.name`),
      i18n(`${i18nKey}.labels.accountId`),
      i18n(`${i18nKey}.labels.authType`),
    ])
  );

  logger.log(i18n(`${i18nKey}.configPath`, { configPath }));
  logger.log(
    i18n(`${i18nKey}.defaultAccount`, { account: config.defaultPortal })
  );
  logger.log(i18n(`${i18nKey}.accounts`));
  logger.log(getTableContents(portalData, { border: { bodyLeft: '  ' } }));
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs.example([['$0 accounts list']]);

  return yargs;
};
