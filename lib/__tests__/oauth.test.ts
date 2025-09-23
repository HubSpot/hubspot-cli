import express, { Request, Response } from 'express';
import open from 'open';
import { OAuth2Manager } from '@hubspot/local-dev-lib/models/OAuth2Manager';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { addOauthToAccountConfig } from '@hubspot/local-dev-lib/oauth';
import { logger } from '@hubspot/local-dev-lib/logger';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { DEFAULT_OAUTH_SCOPES } from '@hubspot/local-dev-lib/constants/auth';
import { authenticateWithOauth } from '../oauth.js';
import { Mock } from 'vitest';

vi.mock('express');
vi.mock('open');
vi.mock('@hubspot/local-dev-lib/models/OAuth2Manager');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/local-dev-lib/oauth');
vi.mock('@hubspot/local-dev-lib/logger');

const mockedExpress = express as unknown as Mock;
const mockedOAuth2Manager = OAuth2Manager as unknown as Mock;
const mockedGetAccountConfig = getAccountConfig as Mock;

describe('lib/oauth', () => {
  const mockExpressReq = {
    query: { code: 'test-auth-code' },
  } as unknown as Request;
  const mockExpressResp = { send: vi.fn() } as unknown as Response;

  const mockAccountConfig = {
    accountId: 123,
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    scopes: ['test-scope'],
    env: ENVIRONMENTS.PROD,
  };

  beforeEach(() => {
    mockedExpress.mockReturnValue({
      get: vi.fn().mockImplementation((path, callback) => {
        if (path === '/oauth-callback') {
          callback(mockExpressReq, mockExpressResp);
        }
      }),
      listen: vi.fn().mockReturnValue({ close: vi.fn() }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('authenticateWithOauth()', () => {
    it('should setup OAuth and authenticate successfully', async () => {
      // Mock successful OAuth flow
      const mockOAuth2Manager = {
        account: mockAccountConfig,
        exchangeForTokens: vi.fn().mockResolvedValue({}),
      };

      mockedOAuth2Manager.mockImplementation(() => mockOAuth2Manager);
      mockedGetAccountConfig.mockReturnValue({
        env: ENVIRONMENTS.PROD,
      });

      await authenticateWithOauth(mockAccountConfig);

      // Verify OAuth2Manager was initialized correctly
      expect(mockedOAuth2Manager).toHaveBeenCalledWith({
        ...mockAccountConfig,
        env: ENVIRONMENTS.PROD,
      });

      // Verify logger was called
      expect(logger.log).toHaveBeenCalledWith('Authorizing');

      // Verify OAuth tokens were added to config
      expect(addOauthToAccountConfig).toHaveBeenCalledWith(mockOAuth2Manager);
    });

    it('should handle missing clientId', async () => {
      const invalidConfig = {
        ...mockAccountConfig,
        clientId: undefined,
      };

      mockedOAuth2Manager.mockImplementation(() => ({
        account: invalidConfig,
      }));

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('exit');
      });

      await expect(authenticateWithOauth(invalidConfig)).rejects.toThrow(
        'exit'
      );
      expect(logger.error).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalled();
      exitSpy.mockRestore();
    });

    it('should use default scopes when none provided', async () => {
      const configWithoutScopes = {
        ...mockAccountConfig,
        scopes: undefined,
      };

      const mockOAuth2Manager = {
        account: configWithoutScopes,
        exchangeForTokens: vi.fn().mockResolvedValue({}),
      };

      mockedOAuth2Manager.mockImplementation(() => mockOAuth2Manager);

      await authenticateWithOauth(configWithoutScopes);

      // Verify default scopes were used
      expect(open).toHaveBeenCalledWith(
        expect.stringContaining(
          encodeURIComponent(DEFAULT_OAUTH_SCOPES.join(' '))
        ),
        expect.anything()
      );
    });

    it('should handle OAuth exchange failure', async () => {
      const mockOAuth2Manager = {
        account: mockAccountConfig,
        exchangeForTokens: vi
          .fn()
          .mockRejectedValue(new Error('Exchange failed')),
      };

      mockedOAuth2Manager.mockImplementation(() => mockOAuth2Manager);

      await authenticateWithOauth(mockAccountConfig);

      expect(mockExpressResp.send).toHaveBeenCalledWith(
        expect.stringContaining('Authorization failed')
      );
    });
  });
});
