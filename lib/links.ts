import open from 'open';
import { getEnv } from '@hubspot/local-dev-lib/config';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { logger } from '@hubspot/local-dev-lib/logger';
import { getTableContents, getTableHeader } from './ui/table';

type SiteLink = {
  shortcut: string;
  alias?: string;
  getUrl: (a: number) => string;
  url?: string;
};

const SITE_LINKS: { [key: string]: SiteLink } = {
  APPS_MARKETPLACE: {
    shortcut: 'apps-marketplace',
    alias: 'apm',
    getUrl: (a: number): string => `ecosystem/${a}/marketplace/apps`,
  },
  ASSET_MARKETPLACE: {
    shortcut: 'asset-marketplace',
    alias: 'asm',
    getUrl: (a: number): string => `ecosystem/${a}/marketplace/products`,
  },
  CONTENT_STAGING: {
    shortcut: 'content-staging',
    alias: 'cs',
    getUrl: (a: number): string => `content/${a}/staging`,
  },
  DESIGN_MANAGER: {
    shortcut: 'design-manager',
    alias: 'dm',
    getUrl: (a: number): string => `design-manager/${a}`,
  },
  DOCS: {
    shortcut: 'docs',
    getUrl: (): string => 'https://developers.hubspot.com',
  },
  FILE_MANAGER: {
    shortcut: 'file-manager',
    alias: 'fm',
    getUrl: (a: number): string => `files/${a}`,
  },
  FORUMS: {
    shortcut: 'forums',
    getUrl: (): string => 'https://community.hubspot.com',
  },
  HUBDB: {
    shortcut: 'hubdb',
    alias: 'hdb',
    getUrl: (a: number): string => `hubdb/${a}`,
  },
  SETTINGS: {
    shortcut: 'settings',
    alias: 's',
    getUrl: (a: number): string => `settings/${a}`,
  },
  SETTINGS_NAVIGATION: {
    shortcut: 'settings/navigation',
    alias: 'sn',
    getUrl: (a: number): string => `menus/${a}/edit/`,
  },
  SETTINGS_WEBSITE: {
    shortcut: 'settings/website',
    alias: 'sw',
    getUrl: (a: number): string =>
      `settings/${a}/website/pages/all-domains/page-templates`,
  },
  SETTINGS_getUrl_REDIRECTS: {
    shortcut: 'settings/url-redirects',
    alias: 'sur',
    getUrl: (a: number): string => `domains/${a}/url-redirects`,
  },
  PURCHASED_ASSETS: {
    shortcut: 'purchased-assets',
    alias: 'pa',
    getUrl: (a: number): string => `marketplace/${a}/manage-purchases`,
  },
  WEBSITE_PAGES: {
    shortcut: 'website-pages',
    alias: 'wp',
    getUrl: (a: number): string => `website/${a}/pages/site`,
  },
};

export function getSiteLinksAsArray(accountId: number): SiteLink[] {
  return Object.values(SITE_LINKS)
    .sort((a, b) => (a.shortcut < b.shortcut ? -1 : 1))
    .map(l => ({ ...l, url: l.getUrl(accountId) }));
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
    getEnv() === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
  );

  open(`${baseUrl}/${match.getUrl(accountId)}`, { url: true });
  logger.success(`We opened ${match.getUrl(accountId)} in your browser`);
}
