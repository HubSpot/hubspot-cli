import open from 'open';
import { getConfigAccountEnvironment } from '@hubspot/local-dev-lib/config';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { logger } from '@hubspot/local-dev-lib/logger';
import { getTableContents, getTableHeader } from './ui/table';

type SiteLink = {
  shortcut: string;
  alias?: string;
  getUrl: (accountId: number, baseUrl: string) => string;
  url?: string;
};

const SITE_LINKS: { [key: string]: SiteLink } = {
  APPS_MARKETPLACE: {
    shortcut: 'apps-marketplace',
    alias: 'apm',
    getUrl: (accountId: number, baseUrl: string): string =>
      `${baseUrl}/ecosystem/${accountId}/marketplace/apps`,
  },
  ASSET_MARKETPLACE: {
    shortcut: 'asset-marketplace',
    alias: 'asm',
    getUrl: (accountId: number, baseUrl: string): string =>
      `${baseUrl}/ecosystem/${accountId}/marketplace/products`,
  },
  CONTENT_STAGING: {
    shortcut: 'content-staging',
    alias: 'cs',
    getUrl: (accountId: number, baseUrl: string): string =>
      `${baseUrl}/content/${accountId}/staging`,
  },
  DESIGN_MANAGER: {
    shortcut: 'design-manager',
    alias: 'dm',
    getUrl: (accountId: number, baseUrl: string): string =>
      `${baseUrl}/design-manager/${accountId}`,
  },
  DOCS: {
    shortcut: 'docs',
    getUrl: (): string => 'https://developers.hubspot.com',
  },
  FILE_MANAGER: {
    shortcut: 'file-manager',
    alias: 'fm',
    getUrl: (accountId: number, baseUrl: string): string =>
      `${baseUrl}/files/${accountId}`,
  },
  FORUMS: {
    shortcut: 'forums',
    getUrl: (): string => 'https://community.hubspot.com',
  },
  HUBDB: {
    shortcut: 'hubdb',
    alias: 'hdb',
    getUrl: (accountId: number, baseUrl: string): string =>
      `${baseUrl}/hubdb/${accountId}`,
  },
  SETTINGS: {
    shortcut: 'settings',
    alias: 's',
    getUrl: (accountId: number, baseUrl: string): string =>
      `${baseUrl}/settings/${accountId}`,
  },
  SETTINGS_NAVIGATION: {
    shortcut: 'settings/navigation',
    alias: 'sn',
    getUrl: (accountId: number, baseUrl: string): string =>
      `${baseUrl}/menus/${accountId}/edit/`,
  },
  SETTINGS_WEBSITE: {
    shortcut: 'settings/website',
    alias: 'sw',
    getUrl: (accountId: number, baseUrl: string): string =>
      `${baseUrl}/settings/${accountId}/website/pages/all-domains/page-templates`,
  },
  SETTINGS_getUrl_REDIRECTS: {
    shortcut: 'settings/url-redirects',
    alias: 'sur',
    getUrl: (accountId: number, baseUrl: string): string =>
      `${baseUrl}/domains/${accountId}/url-redirects`,
  },
  PURCHASED_ASSETS: {
    shortcut: 'purchased-assets',
    alias: 'pa',
    getUrl: (accountId: number, baseUrl: string): string =>
      `${baseUrl}/marketplace/${accountId}/manage-purchases`,
  },
  WEBSITE_PAGES: {
    shortcut: 'website-pages',
    alias: 'wp',
    getUrl: (accountId: number, baseUrl: string): string =>
      `${baseUrl}/website/${accountId}/pages/site`,
  },
};

export function getSiteLinksAsArray(accountId: number): SiteLink[] {
  const baseUrl = getHubSpotWebsiteOrigin(
    getConfigAccountEnvironment(accountId)
  );

  return Object.values(SITE_LINKS)
    .sort((a, b) => (a.shortcut < b.shortcut ? -1 : 1))
    .map(l => ({ ...l, url: l.getUrl(accountId, baseUrl) }));
}

export function logSiteLinks(accountId: number): void {
  const linksAsArray = getSiteLinksAsArray(accountId).map(l => [
    `${l.shortcut}${l.alias ? ` [alias: ${l.alias}]` : ''}`,
    '=>',
    l.url,
  ]);

  linksAsArray.unshift(getTableHeader(['Shortcut', '', 'Url']));

  logger.log(getTableContents(linksAsArray));
}

export function openLink(accountId: number, shortcut: string): void {
  const match = Object.values(SITE_LINKS).find(
    l => l.shortcut === shortcut || (l.alias && l.alias === shortcut)
  );

  if (!match) {
    logger.error(
      `We couldn't find a shortcut matching ${shortcut}.  Type 'hs open list' to see a list of available shortcuts`
    );
    return;
  }

  const baseUrl = getHubSpotWebsiteOrigin(
    getConfigAccountEnvironment(accountId)
  );

  open(match.getUrl(accountId, baseUrl), { url: true });
  logger.success(
    `We opened ${match.getUrl(accountId, baseUrl)} in your browser`
  );
}
