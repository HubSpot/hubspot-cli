import { sendFeedback } from '../../api/feedback.js';
import { getConfigCredentials } from '../accountCredentials.js';
import { pkg } from '../jsonLoader.js';
import { containsAccountCredentials, submitFeedback } from '../feedback.js';

vi.mock('../accountCredentials.js');
vi.mock('../../api/feedback.js');

const getConfigCredentialsMock = vi.mocked(getConfigCredentials);
const sendFeedbackMock = vi.mocked(sendFeedback);

describe('lib/feedback', () => {
  describe('containsAccountCredentials()', () => {
    beforeEach(() => {
      getConfigCredentialsMock.mockReturnValue(['pak-secret']);
    });

    it('should return false when the feedback has no credentials', () => {
      expect(containsAccountCredentials('Great tool')).toBe(false);
    });

    it('should return true when the feedback contains a credential', () => {
      expect(containsAccountCredentials('My key is pak-secret')).toBe(true);
    });
  });

  describe('submitFeedback()', () => {
    it('should send the feedback with the CLI version', async () => {
      await submitFeedback(123, 'Great tool', 'agent');

      expect(sendFeedbackMock).toHaveBeenCalledWith(123, {
        feedback: 'Great tool',
        source: 'agent',
        cliVersion: pkg.version,
      });
    });

    it('should throw when the request fails', async () => {
      sendFeedbackMock.mockRejectedValue(new Error('Request failed'));

      await expect(submitFeedback(123, 'Great tool', 'user')).rejects.toThrow(
        'Request failed'
      );
    });
  });
});
