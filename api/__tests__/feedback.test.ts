import { http } from '@hubspot/local-dev-lib/http';
import { Mock } from 'vitest';
import { sendFeedback } from '../feedback.js';

vi.mock('@hubspot/local-dev-lib/http');

const mockedHttpPost = http.post as Mock;

const accountId = 123;

describe('api/feedback', () => {
  describe('sendFeedback', () => {
    it('should call http correctly', async () => {
      const request = {
        feedback: 'Great tool',
        source: 'agent' as const,
        cliVersion: '1.0.0',
      };

      await sendFeedback(accountId, request);

      expect(mockedHttpPost).toHaveBeenCalledTimes(1);
      expect(mockedHttpPost).toHaveBeenCalledWith(accountId, {
        url: 'local/dev/tools/proxy/v1/feedback',
        data: request,
      });
    });
  });
});
