const { logger } = require('@hubspot/cli-lib/logger');
const { getConfig, getConfigPath } = require('@hubspot/local-dev-lib/config');
const {
  getTableContents,
  getTableHeader,
} = require('@hubspot/local-dev-lib/logging/table');

const {
  addConfigOptions,
  addAccountOptions,
  getAccountId,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');
const { getSandboxTypeAsString } = require('../../lib/sandboxes');
const { i18n } = require('../../lib/lang');

const i18nKey = 'cli.commands.accounts.subcommands.list';

exports.command = 'list';
exports.describe = i18n(`${i18nKey}.describe`);

const sortAndMapPortals = portals => {
  const mappedPortalData = {};
  portals
    .sort((a, b) => {
      if (a.sandboxAccountType === null && b.sandboxAccountType !== null) {
        return -1;
      }
      if (a.sandboxAccountType !== null && b.sandboxAccountType === null) {
        return 1;
      }
      return 0;
    })
    .forEach(portal => {
      if (
        portal.sandboxAccountType !== undefined &&
        portal.sandboxAccountType === null
      ) {
        mappedPortalData[portal.portalId] = [portal];
      } else if (portal.sandboxAccountType && portal.parentAccountId) {
        mappedPortalData[portal.parentAccountId] = [
          ...(mappedPortalData[portal.parentAccountId] || []),
          portal,
        ];
      } else {
        mappedPortalData[portal.portalId] = [portal];
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
          `↳ ${portal.name} [${getSandboxTypeAsString(
            portal.sandboxAccountType
          )} sandbox]`,
          portal.portalId,
          portal.authType,
        ]);
      }
    });
  });
  return portalData;
};

exports.handler = async options => {
  await loadAndValidateOptions(options, false);

  const accountId = getAccountId(options);

  trackCommandUsage('accounts-list', null, accountId);

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
