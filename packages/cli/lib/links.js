const { getEnv } = require('@hubspot/local-dev-lib/config');
const { ENVIRONMENTS } = require('@hubspot/cli-lib/lib/constants');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  getTableContents,
  getTableHeader,
} = require('@hubspot/local-dev-lib/logging/table');

const open = require('open');

const logSiteLinks = accountId => {
  const linksAsArray = getSiteLinksAsArray(accountId).map(l => [
    `${l.shortcut}${l.alias ? ` [alias: ${l.alias}]` : ''}`,
    '=>',
    l.url,
  ]);

  linksAsArray.unshift(getTableHeader(['Shortcut', '', 'Url']));

  logger.log(getTableContents(linksAsArray));
};

const getSiteLinksAsArray = accountId =>
  Object.values(getSiteLinks(accountId)).sort((a, b) =>
    a.shortcut < b.shortcut ? -1 : 1
  );

const getSiteLinks = accountId => {
  const baseUrl = getHubSpotWebsiteOrigin(
    getEnv() === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
  );

  return {
    APPS_MARKETPLACE: {
      shortcut: 'apps-marketplace',
      alias: 'apm',
      url: `${baseUrl}/ecosystem/${accountId}/marketplace/apps`,
    },
    ASSET_MARKETPLACE: {
      shortcut: 'asset-marketplace',
      alias: 'asm',
      url: `${baseUrl}/ecosystem/${accountId}/marketplace/products`,
    },
    CONTENT_STAGING: {
      shortcut: 'content-staging',
      alias: 'cs',
      url: `${baseUrl}/content/${accountId}/staging`,
    },
    DESIGN_MANAGER: {
      shortcut: 'design-manager',
      alias: 'dm',
      url: `${baseUrl}/design-manager/${accountId}`,
    },
    DOCS: {
      shortcut: 'docs',
      url: 'https://developers.hubspot.com',
    },
    FILE_MANAGER: {
      shortcut: 'file-manager',
      alias: 'fm',
      url: `${baseUrl}/files/${accountId}`,
    },
    FORUMS: {
      shortcut: 'forums',
      url: 'https://community.hubspot.com',
    },
    HUBDB: {
      shortcut: 'hubdb',
      alias: 'hdb',
      url: `${baseUrl}/hubdb/${accountId}`,
    },
    SETTINGS: {
      shortcut: 'settings',
      alias: 's',
      url: `${baseUrl}/settings/${accountId}`,
    },
    SETTINGS_NAVIGATION: {
      shortcut: 'settings/navigation',
      alias: 'sn',
      url: `${baseUrl}/menus/${accountId}/edit/`,
    },
    SETTINGS_WEBSITE: {
      shortcut: 'settings/website',
      alias: 'sw',
      url: `${baseUrl}/settings/${accountId}/website/pages/all-domains/page-templates`,
    },
    SETTINGS_URL_REDIRECTS: {
      shortcut: 'settings/url-redirects',
      alias: 'sur',
      url: `${baseUrl}/domains/${accountId}/url-redirects`,
    },
    PURCHASED_ASSETS: {
      shortcut: 'purchased-assets',
      alias: 'pa',
      url: `${baseUrl}/marketplace/${accountId}/manage-purchases`,
    },

    WEBSITE_PAGES: {
      shortcut: 'website-pages',
      alias: 'wp',
      url: `${baseUrl}/website/${accountId}/pages/site`,
    },
  };
};

const openLink = (accountId, shortcut) => {
  const match = Object.values(getSiteLinks(accountId)).find(
    l => l.shortcut === shortcut || (l.alias && l.alias === shortcut)
  );

  if (!match) {
    logger.error(
      `We couldn't find a shortcut matching ${shortcut}.  Type 'hs open list' to see a list of available shortcuts`
    );
    return;
  }

  open(match.url, { url: true });
  logger.success(`We opened ${match.url} in your browser`);
};

module.exports = {
  getSiteLinks,
  getSiteLinksAsArray,
  logSiteLinks,
  openLink,
};
