import { getAllConfigAccounts } from '@hubspot/local-dev-lib/config';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { getConfigCredentials } from '../accountCredentials.js';

vi.mock('@hubspot/local-dev-lib/config');

const getAllConfigAccountsMock = vi.mocked(getAllConfigAccounts);

describe('lib/accountCredentials', () => {
  describe('getConfigCredentials()', () => {
    it('should return the credentials of every configured account', () => {
      getAllConfigAccountsMock.mockReturnValue([
        {
          accountId: 123,
          authType: 'personalaccesskey',
          personalAccessKey: 'pak-secret',
          auth: { tokenInfo: { accessToken: 'pak-access-token' } },
        },
        {
          accountId: 456,
          authType: 'oauth2',
          auth: {
            clientId: 'client-id',
            clientSecret: 'client-secret',
            scopes: [],
            tokenInfo: { refreshToken: 'oauth-refresh-token' },
          },
        },
        {
          accountId: 789,
          authType: 'apikey',
          apiKey: 'api-key-secret',
        },
        {
          accountId: 1011,
          authType: 'accesstoken',
          auth: { tokenInfo: { accessToken: 'access-token-secret' } },
        },
      ] as HubSpotConfigAccount[]);

      expect(getConfigCredentials()).toEqual([
        'pak-secret',
        'pak-access-token',
        'client-secret',
        'oauth-refresh-token',
        'api-key-secret',
        'access-token-secret',
      ]);
    });

    it('should return no credentials when there is no config', () => {
      getAllConfigAccountsMock.mockImplementation(() => {
        throw new Error('Config not found');
      });

      expect(getConfigCredentials()).toEqual([]);
    });
  });
});
