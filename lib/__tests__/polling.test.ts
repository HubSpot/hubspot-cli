import { poll, DEFAULT_POLLING_STATES } from '../polling.js';
import { DEFAULT_POLLING_DELAY } from '../constants.js';
import { HubSpotPromise } from '@hubspot/local-dev-lib/types/Http';

// Mock response types
type MockResponse = {
  status: string;
};

// Helper to create a mock polling callback
const createMockCallback = (responses: MockResponse[]) => {
  let callCount = 0;
  return vi.fn((): HubSpotPromise<{ status: string }> => {
    const response = responses[callCount];
    callCount++;
    return Promise.resolve({ data: response }) as HubSpotPromise<{
      status: string;
    }>;
  });
};

describe('lib/polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('poll()', () => {
    it('should resolve when status is SUCCESS', async () => {
      const mockCallback = createMockCallback([
        { status: DEFAULT_POLLING_STATES.STARTED },
        { status: DEFAULT_POLLING_STATES.SUCCESS },
      ]);

      const pollPromise = poll(mockCallback);

      // Fast-forward through two polling intervals
      vi.advanceTimersByTime(DEFAULT_POLLING_DELAY * 2);

      const result = await pollPromise;
      expect(result.status).toBe(DEFAULT_POLLING_STATES.SUCCESS);
      expect(mockCallback).toHaveBeenCalledTimes(2);
    });

    it('should reject when status is ERROR', async () => {
      const mockCallback = createMockCallback([
        { status: DEFAULT_POLLING_STATES.STARTED },
        { status: DEFAULT_POLLING_STATES.ERROR },
      ]);

      const pollPromise = poll(mockCallback);

      vi.advanceTimersByTime(DEFAULT_POLLING_DELAY * 2);

      await expect(pollPromise).rejects.toEqual({
        status: DEFAULT_POLLING_STATES.ERROR,
      });
      expect(mockCallback).toHaveBeenCalledTimes(2);
    });

    it('should reject when status is FAILURE', async () => {
      const mockCallback = createMockCallback([
        { status: DEFAULT_POLLING_STATES.STARTED },
        { status: DEFAULT_POLLING_STATES.FAILURE },
      ]);

      const pollPromise = poll(mockCallback);

      vi.advanceTimersByTime(DEFAULT_POLLING_DELAY * 2);

      await expect(pollPromise).rejects.toEqual({
        status: DEFAULT_POLLING_STATES.FAILURE,
      });
    });

    it('should reject when status is REVERTED', async () => {
      const mockCallback = createMockCallback([
        { status: DEFAULT_POLLING_STATES.STARTED },
        { status: DEFAULT_POLLING_STATES.REVERTED },
      ]);

      const pollPromise = poll(mockCallback);

      vi.advanceTimersByTime(DEFAULT_POLLING_DELAY * 2);

      await expect(pollPromise).rejects.toEqual({
        status: DEFAULT_POLLING_STATES.REVERTED,
      });
    });

    it('should reject when callback throws an error', async () => {
      const mockCallback = vi
        .fn()
        .mockRejectedValue(new Error('Network error'));

      const pollPromise = poll(mockCallback);

      vi.advanceTimersByTime(DEFAULT_POLLING_DELAY);

      await expect(pollPromise).rejects.toThrow('Network error');
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });
});
