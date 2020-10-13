const requestPN = require('request-promise-native');
const request = require('request');
const fs = require('fs-extra');
const moment = require('moment');
const { getAndLoadConfigIfNeeded, getAccountConfig } = require('../lib/config');
const { ENVIRONMENTS } = require('../lib/constants');
const http = require('../http');
const { version } = require('../package.json');

jest.mock('request-promise-native', () => ({
  get: jest.fn().mockReturnValue(Promise.resolve()),
  post: jest.fn().mockReturnValue(Promise.resolve()),
}));

jest.mock('request');
jest.mock('../lib/config');
jest.mock('../logger');

describe('http', () => {
  afterEach(() => {
    jest.clearAllMocks();
    getAndLoadConfigIfNeeded.mockReset();
    getAccountConfig.mockReset();
  });
  describe('getOctetStream()', () => {
    beforeEach(() => {
      getAndLoadConfigIfNeeded.mockReturnValue({
        httpTimeout: 1000,
        portals: [
          {
            id: 123,
            apiKey: 'abc',
          },
        ],
      });
      getPortalConfig.mockReturnValue({
        id: 123,
        apiKey: 'abc',
      });
    });
    it('makes a get request', async () => {
      request.get.mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'response') {
            callback({ statusCode: 200 });
          }
        }),
        pipe: jest.fn(),
      });
      await http.getOctetStream(
        123,
        {
          uri: 'some/endpoint/path',
        },
        'path/to/local/file'
      );

      expect(request.get).toHaveBeenCalledWith(
        expect.objectContaining({ uri: 'some/endpoint/path' })
      );
    });
    it('fetches a file and attempts to write it', async () => {
      request.get.mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'response') {
            callback({ statusCode: 200 });
          }
        }),
        pipe: jest.fn(),
      });
      await http.getOctetStream(
        123,
        {
          uri: 'some/endpoint/path',
        },
        'path/to/local/file'
      );

      expect(fs.createWriteStream).toBeCalledWith('path/to/local/file', {
        encoding: 'binary',
      });
    });
    it('fails to fetch a file and does not attempt to write to disk', async () => {
      request.get.mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'response') {
            callback({ statusCode: 404 });
          }
        }),
        pipe: jest.fn(),
      });
      try {
        await http.getOctetStream(
          123,
          {
            uri: 'some/nonexistent/path',
          },
          'path/to/local/file'
        );
      } catch (e) {
        expect(e.statusCode).toBe(404);
        expect(fs.createWriteStream).not.toBeCalled();
      }
    });
  });
  describe('getRequestOptions()', () => {
    it('constructs baseUrl as expected based on environment', () => {
      getAndLoadConfigIfNeeded.mockReturnValue({
        accounts: [],
      });

      expect(http.getRequestOptions()).toMatchObject({
        baseUrl: 'https://api.hubapi.com',
      });
      expect(http.getRequestOptions({ env: ENVIRONMENTS.QA })).toMatchObject({
        baseUrl: 'https://api.hubapiqa.com',
      });
    });
    it('supports httpUseLocalhost config option to construct baseUrl for local HTTP services', () => {
      getAndLoadConfigIfNeeded.mockReturnValue({
        httpUseLocalhost: true,
        accounts: [],
      });

      expect(http.getRequestOptions()).toMatchObject({
        baseUrl: 'https://local.hubapi.com',
      });
      expect(http.getRequestOptions({ env: ENVIRONMENTS.QA })).toMatchObject({
        baseUrl: 'https://local.hubapiqa.com',
      });
    });
  });
  describe('get()', () => {
    it('adds authorization header when using OAuth2 with valid access token', async () => {
      const accessToken = 'let-me-in';
      const account = {
        id: 123,
        authType: 'oauth2',
        clientId: 'd996372f-2b53-30d3-9c3b-4fdde4bce3a2',
        clientSecret: 'f90a6248-fbc0-3b03-b0db-ec58c95e791',
        scopes: ['content'],
        tokenInfo: {
          expiresAt: moment()
            .add(2, 'hours')
            .toISOString(),
          refreshToken: '84d22710-4cb7-5581-ba05-35f9945e5e8e',
          accessToken,
        },
      };
      getAndLoadConfigIfNeeded.mockReturnValue({
        accounts: [account],
      });
      getAccountConfig.mockReturnValue(account);
      await http.get(123, {
        uri: 'some/endpoint/path',
      });

      expect(requestPN.get).toBeCalledWith({
        baseUrl: `https://api.hubapi.com`,
        uri: 'some/endpoint/path',
        headers: {
          'User-Agent': `HubSpot CMS Tools/${version}`,
          Authorization: `Bearer ${accessToken}`,
        },
        json: true,
        simple: true,
        timeout: 15000,
        qs: {
          portalId: 123,
        },
      });
    });
    it('adds authorization header when using a user token', async () => {
      const accessToken = 'let-me-in';
      const account = {
        id: 123,
        authType: 'personalaccesskey',
        personalAccessKey: 'some-secret',
        auth: {
          tokenInfo: {
            expiresAt: moment()
              .add(2, 'hours')
              .toISOString(),
            accessToken,
          },
        },
      };
      getAndLoadConfigIfNeeded.mockReturnValue({
        accounts: [account],
      });
      getAccountConfig.mockReturnValue(account);
      await http.get(123, {
        uri: 'some/endpoint/path',
      });

      expect(requestPN.get).toBeCalledWith({
        baseUrl: `https://api.hubapi.com`,
        uri: 'some/endpoint/path',
        headers: {
          'User-Agent': `HubSpot CMS Tools/${version}`,
          Authorization: `Bearer ${accessToken}`,
        },
        json: true,
        simple: true,
        timeout: 15000,
        qs: {
          portalId: 123,
        },
      });
    });

    it('supports setting a custom timeout', async () => {
      getAndLoadConfigIfNeeded.mockReturnValue({
        httpTimeout: 1000,
        accounts: [
          {
            id: 123,
            apiKey: 'abc',
          },
        ],
      });
      getAccountConfig.mockReturnValue({
        id: 123,
        apiKey: 'abc',
      });

      await http.get(123, {
        uri: 'some/endpoint/path',
      });

      expect(requestPN.get).toBeCalledWith({
        baseUrl: `https://api.hubapi.com`,
        uri: 'some/endpoint/path',
        headers: {
          'User-Agent': `HubSpot CMS Tools/${version}`,
        },
        json: true,
        simple: true,
        timeout: 1000,
        qs: {
          portalId: 123,
          hapikey: 'abc',
        },
      });
    });
  });
});
