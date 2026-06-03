import { http as unauthedHttp } from '@hubspot/local-dev-lib/http/unauthed';
import { sendUsageEvent } from '../usageTracking.js';
import { Mock } from 'vitest';

vi.mock('@hubspot/local-dev-lib/http/unauthed');

const mockedUnauthedHttpPost = unauthedHttp.post as Mock;

const mockRequest = {
  eventName: 'cli-interaction',
  eventClass: 'INTERACTION',
  meta: { action: 'cli-command' },
};

describe('lib/api/usageTracking', () => {
  describe('sendUsageEvent()', () => {
    function expectUnauthedPostWithData(data: object): void {
      expect(mockedUnauthedHttpPost).toHaveBeenCalledOnce();
      expect(mockedUnauthedHttpPost).toHaveBeenCalledWith({
        url: 'local/dev/tools/proxy/v1/usage',
        data,
      });
    }

    it('should send to unauthenticated endpoint when no accountId', async () => {
      await sendUsageEvent(mockRequest);

      expectUnauthedPostWithData(mockRequest);
    });

    it('should send to unauthenticated endpoint when accountId is present', async () => {
      await sendUsageEvent({ ...mockRequest, accountId: 123 });

      expectUnauthedPostWithData({ ...mockRequest, accountId: 123 });
    });

    it('should send to unauthenticated endpoint when accountId and userId are present', async () => {
      await sendUsageEvent({ ...mockRequest, accountId: 123, userId: 456 });

      expectUnauthedPostWithData({
        ...mockRequest,
        accountId: 123,
        userId: 456,
      });
    });

    it('should send to unauthenticated endpoint when userId is present without accountId', async () => {
      await sendUsageEvent({ ...mockRequest, userId: 456 });

      expectUnauthedPostWithData({ ...mockRequest, userId: 456 });
    });

    it('should preserve the full request body', async () => {
      const request = {
        portalId: 789,
        accountId: 123,
        userId: 456,
        eventName: 'cli-interaction',
        eventClass: 'INTERACTION',
        meta: {
          action: 'cli-command',
          command: 'project-upload',
          successful: true,
          executionTime: 100,
        },
      };

      await sendUsageEvent(request);

      expectUnauthedPostWithData(request);
    });

    it('should not throw when unauthenticated post throws', async () => {
      mockedUnauthedHttpPost.mockRejectedValueOnce(new Error('network error'));

      await expect(sendUsageEvent(mockRequest)).resolves.toBeUndefined();
    });
  });
});
