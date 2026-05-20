import { http } from '@hubspot/local-dev-lib/http';
import { http as unauthedHttp } from '@hubspot/local-dev-lib/http/unauthed';
import { getConfigAccountById } from '@hubspot/local-dev-lib/config';
import { sendUsageEvent } from '../usageTracking.js';
import { Mock } from 'vitest';

vi.mock('@hubspot/local-dev-lib/http');
vi.mock('@hubspot/local-dev-lib/http/unauthed');
vi.mock('@hubspot/local-dev-lib/config');

const mockedHttpPost = http.post as Mock;
const mockedUnauthedHttpPost = unauthedHttp.post as Mock;
const mockedGetConfigAccountById = getConfigAccountById as Mock;

const mockRequest = {
  eventName: 'cli-interaction',
  eventClass: 'INTERACTION',
  meta: { action: 'cli-command' },
};

describe('lib/api/usageTracking', () => {
  describe('sendUsageEvent()', () => {
    it('should send to unauthenticated endpoint when no accountId', async () => {
      await sendUsageEvent(mockRequest);

      expect(mockedUnauthedHttpPost).toHaveBeenCalledWith({
        url: 'local/dev/tools/proxy/v1/usage',
        data: mockRequest,
      });
      expect(mockedHttpPost).not.toHaveBeenCalled();
    });

    it('should send to unauthenticated endpoint when account is not personalaccesskey', async () => {
      mockedGetConfigAccountById.mockReturnValue({ authType: 'oauth2' });

      await sendUsageEvent({ ...mockRequest, accountId: 123 });

      expect(mockedUnauthedHttpPost).toHaveBeenCalledWith({
        url: 'local/dev/tools/proxy/v1/usage',
        data: { ...mockRequest, accountId: 123 },
      });
      expect(mockedHttpPost).not.toHaveBeenCalled();
    });

    it('should send to authenticated endpoint when account is personalaccesskey', async () => {
      mockedGetConfigAccountById.mockReturnValue({
        authType: 'personalaccesskey',
      });

      await sendUsageEvent({ ...mockRequest, accountId: 123 });

      expect(mockedHttpPost).toHaveBeenCalledWith(123, {
        url: 'local/dev/tools/proxy/v1/usage/authenticated',
        data: { ...mockRequest, accountId: 123 },
      });
      expect(mockedUnauthedHttpPost).not.toHaveBeenCalled();
    });

    it('should fall back to unauthenticated endpoint when authenticated call throws', async () => {
      mockedGetConfigAccountById.mockReturnValue({
        authType: 'personalaccesskey',
      });
      mockedHttpPost.mockRejectedValueOnce(new Error('auth failed'));

      await sendUsageEvent({ ...mockRequest, accountId: 123 });

      expect(mockedUnauthedHttpPost).toHaveBeenCalledWith({
        url: 'local/dev/tools/proxy/v1/usage',
        data: { ...mockRequest, accountId: 123 },
      });
    });

    it('should not throw when getConfigAccountById throws', async () => {
      mockedGetConfigAccountById.mockImplementationOnce(() => {
        throw new Error('config error');
      });

      await expect(
        sendUsageEvent({ ...mockRequest, accountId: 123 })
      ).resolves.toBeUndefined();
    });

    it('should not throw when unauthenticated post throws', async () => {
      mockedUnauthedHttpPost.mockRejectedValueOnce(new Error('network error'));

      await expect(sendUsageEvent(mockRequest)).resolves.toBeUndefined();
    });
  });
});
