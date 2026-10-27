import { HubSpotHttpError } from '@hubspot/local-dev-lib/models/HubSpotHttpError';
import { getConfigCredentials } from '../../../lib/accountCredentials.js';
import { getToolErrorMessage } from '../errors.js';

vi.mock('../../../lib/accountCredentials.js');

const mockGetConfigCredentials = vi.mocked(getConfigCredentials);

describe('mcp-server/utils/errors', () => {
  describe('getToolErrorMessage', () => {
    beforeEach(() => {
      mockGetConfigCredentials.mockReturnValue(['pak-secret']);
    });

    it('should return the message of other errors', () => {
      expect(getToolErrorMessage(new Error('Network error'))).toBe(
        'Network error'
      );
    });

    it('should return toString() of HubSpot HTTP errors with config credentials redacted', () => {
      const error = new HubSpotHttpError('Unauthorized', {
        cause: {
          isAxiosError: true,
          code: 'ERR_BAD_REQUEST',
          config: {
            url: 'localdevauth/v1/auth/refresh',
            method: 'post',
            data: '{"encodedOAuthRefreshToken":"pak-secret"}',
          },
          response: {
            status: 401,
            statusText: 'Unauthorized',
            data: { message: 'The access key is missing scopes.' },
          },
        },
      });

      expect(getToolErrorMessage(error)).toBe(
        error.toString().replaceAll('pak-secret', '[redacted]')
      );
      expect(getToolErrorMessage(error)).toContain(
        '{\\"encodedOAuthRefreshToken\\":\\"[redacted]\\"}'
      );
    });

    it('should redact config credentials in other errors', () => {
      expect(
        getToolErrorMessage(new Error('Request with pak-secret failed'))
      ).toBe('Request with [redacted] failed');
    });
  });
});
