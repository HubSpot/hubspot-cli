const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  getConfig,
  getConfigPath,
  getDefaultAccount,
} = require('@hubspot/local-dev-lib/config');
const { getTableContents, getTableHeader } = require('../../lib/ui/table');

const {
  addConfigOptions,
  addAccountOptions,
  getAccountId,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');
const { isSandbox, isDeveloperTestAccount } = require('../../lib/accountTypes');

const { i18n } = require('../../lib/lang');
const {
  HUBSPOT_ACCOUNT_TYPES,
  HUBSPOT_ACCOUNT_TYPE_STRINGS,
} = require('@hubspot/local-dev-lib/constants/config');
const {
  getAccounts,
  getAccountIdentifier,
} = require('@hubspot/local-dev-lib/utils/getAccountIdentifier');

const i18nKey = 'commands.accounts.subcommands.list';

exports.command = 'list';
exports.describe = i18n(`${i18nKey}.describe`);

const sortAndMapPortals = portals => {
  const mappedPortalData = {};
  // Standard and app developer portals
  portals
    .filter(
      p =>
        p.accountType &&
        (p.accountType === HUBSPOT_ACCOUNT_TYPES.STANDARD ||
          p.accountType === HUBSPOT_ACCOUNT_TYPES.APP_DEVELOPER)
    )
    .forEach(portal => {
      mappedPortalData[getAccountIdentifier(portal)] = [portal];
    });
  // Non-standard portals (sandbox, developer test account)
  portals
    .filter(p => p.accountType && (isSandbox(p) || isDeveloperTestAccount(p)))
    .forEach(p => {
      if (p.parentAccountId) {
        mappedPortalData[p.parentAccountId] = [
          ...(mappedPortalData[p.parentAccountId] || []),
          p,
        ];
      } else {
        mappedPortalData[getAccountIdentifier(p)] = [p];
      }
    });
  return mappedPortalData;
};

const getPortalData = mappedPortalData => {
  const portalData = [];
  Object.entries(mappedPortalData).forEach(([key, set]) => {
    const hasParentPortal = set.filter(
      p => getAccountIdentifier(p) === parseInt(key, 10)
    )[0];
    set.forEach(portal => {
      let name = `${portal.name} [${
        HUBSPOT_ACCOUNT_TYPE_STRINGS[portal.accountType]
      }]`;
      if (isSandbox(portal)) {
        if (hasParentPortal && set.length > 1) {
          name = `↳ ${name}`;
        }
      } else if (isDeveloperTestAccount(portal)) {
        if (hasParentPortal && set.length > 1) {
          name = `↳ ${name}`;
        }
      }
      portalData.push([name, getAccountIdentifier(portal), portal.authType]);
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
  const accountsList = getAccounts(config);
  const mappedPortalData = sortAndMapPortals(accountsList);
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
    i18n(`${i18nKey}.defaultAccount`, {
      account: getDefaultAccount(config),
    })
  );
  logger.log(i18n(`${i18nKey}.accounts`));
  logger.log(getTableContents(portalData, { border: { bodyLeft: '  ' } }));
};

exports.builder = yargs => {
  addConfigOptions(yargs);
  addAccountOptions(yargs);

  yargs.example([['$0 accounts list']]);

  return yargs;
};
