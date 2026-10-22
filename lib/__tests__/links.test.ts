import open from 'open';
import {
  getHubSpotWebsiteOrigin,
  getHubSpotWebsiteOriginByAccountId,
} from '@hubspot/local-dev-lib/urls';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { uiLogger } from '../ui/logger.js';
import { renderTable } from '../../ui/render.js';
import {
  getSiteLinksAsArray,
  logSiteLinks,
  openLink,
  getProductUpdatesUrl,
} from '../links.js';

vi.mock('open');
vi.mock('@hubspot/local-dev-lib/urls');
vi.mock('../../ui/render.js');

const mockedOpen = vi.mocked(open);
const mockedGetHubSpotWebsiteOrigin = vi.mocked(getHubSpotWebsiteOrigin);
const mockedGetHubSpotWebsiteOriginByAccountId = vi.mocked(
  getHubSpotWebsiteOriginByAccountId
);
const mockedRenderTable = vi.mocked(renderTable);
const mockedUiLogger = vi.mocked(uiLogger);

const ACCOUNT_ID = 123;
const BASE_URL = 'https://app.hubspot.com';

describe('lib/links', () => {
  beforeEach(() => {
    mockedGetHubSpotWebsiteOriginByAccountId.mockReturnValue(BASE_URL);
    mockedGetHubSpotWebsiteOrigin.mockReturnValue(BASE_URL);
  });

  describe('getSiteLinksAsArray()', () => {
    it('should return links sorted alphabetically by shortcut', () => {
      const shortcuts = getSiteLinksAsArray(ACCOUNT_ID).map(l => l.shortcut);

      expect(shortcuts).toEqual([...shortcuts].sort());
    });

    it('should populate the url for every link using the account id and base url', () => {
      const links = getSiteLinksAsArray(ACCOUNT_ID);

      expect(mockedGetHubSpotWebsiteOriginByAccountId).toHaveBeenCalledWith(
        ACCOUNT_ID
      );
      links.forEach(link => {
        expect(link.url).toBe(link.getUrl(ACCOUNT_ID, BASE_URL));
      });
    });

    it('should build account scoped urls for design-manager', () => {
      const link = getSiteLinksAsArray(ACCOUNT_ID).find(
        l => l.shortcut === 'design-manager'
      );

      expect(link?.url).toBe(`${BASE_URL}/design-manager/${ACCOUNT_ID}`);
    });

    it('should return static urls for docs and forums', () => {
      const links = getSiteLinksAsArray(ACCOUNT_ID);

      expect(links.find(l => l.shortcut === 'docs')?.url).toBe(
        'https://developers.hubspot.com'
      );
      expect(links.find(l => l.shortcut === 'forums')?.url).toBe(
        'https://community.hubspot.com'
      );
    });
  });

  describe('logSiteLinks()', () => {
    it('should render a table with a header row and one row per link', () => {
      logSiteLinks(ACCOUNT_ID);

      expect(mockedRenderTable).toHaveBeenCalledWith(
        ['Shortcut', '', 'Url'],
        expect.any(Array)
      );
      const rows = mockedRenderTable.mock.calls[0][1];
      expect(rows).toHaveLength(getSiteLinksAsArray(ACCOUNT_ID).length);
    });

    it('should include the alias in the shortcut column when a link has one', () => {
      logSiteLinks(ACCOUNT_ID);

      const rows = mockedRenderTable.mock.calls[0][1];
      expect(rows).toContainEqual([
        'design-manager [alias: dm]',
        '=>',
        `${BASE_URL}/design-manager/${ACCOUNT_ID}`,
      ]);
    });

    it('should omit the alias text when a link has no alias', () => {
      logSiteLinks(ACCOUNT_ID);

      const rows = mockedRenderTable.mock.calls[0][1];
      expect(rows).toContainEqual([
        'docs',
        '=>',
        'https://developers.hubspot.com',
      ]);
    });
  });

  describe('openLink()', () => {
    it('should open the url when given a shortcut', () => {
      const expectedUrl = `${BASE_URL}/design-manager/${ACCOUNT_ID}`;

      openLink(ACCOUNT_ID, 'design-manager');

      expect(mockedOpen).toHaveBeenCalledWith(expectedUrl, { url: true });
      expect(mockedUiLogger.success).toHaveBeenCalledWith(
        `We opened ${expectedUrl} in your browser`
      );
    });

    it('should open the url when given an alias', () => {
      openLink(ACCOUNT_ID, 'dm');

      expect(mockedOpen).toHaveBeenCalledWith(
        `${BASE_URL}/design-manager/${ACCOUNT_ID}`,
        { url: true }
      );
    });

    it('should log an error and not open anything when no link matches', () => {
      openLink(ACCOUNT_ID, 'not-a-real-shortcut');

      expect(mockedUiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('not-a-real-shortcut')
      );
      expect(mockedOpen).not.toHaveBeenCalled();
      expect(mockedUiLogger.success).not.toHaveBeenCalled();
    });
  });

  describe('getProductUpdatesUrl()', () => {
    it('should return an account scoped url when an account id is provided', () => {
      expect(getProductUpdatesUrl('rollout-1', ACCOUNT_ID)).toBe(
        `${BASE_URL}/product-updates/${ACCOUNT_ID}/in-beta?rollout=rollout-1`
      );
      expect(mockedGetHubSpotWebsiteOrigin).not.toHaveBeenCalled();
    });

    it('should return the prod url when no account id is provided', () => {
      expect(getProductUpdatesUrl('rollout-1')).toBe(
        `${BASE_URL}/l/product-updates/in-beta?rollout=rollout-1`
      );
      expect(mockedGetHubSpotWebsiteOrigin).toHaveBeenCalledWith(
        ENVIRONMENTS.PROD
      );
      expect(mockedGetHubSpotWebsiteOriginByAccountId).not.toHaveBeenCalled();
    });
  });
});
