import {
  triggerAutoRelease,
  getAutoReleaseStatus,
} from '../../../api/releases.js';
import { poll } from '../../polling.js';

import { triggerAndPollPreview } from '../preview.js';

vi.mock('../../../api/releases');
vi.mock('../../polling.js');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../ui/SpinniesManager');
vi.mock('../../errorHandlers/index.js');

const mockedTriggerAutoRelease = vi.mocked(triggerAutoRelease);
const mockedGetAutoReleaseStatus = vi.mocked(getAutoReleaseStatus);
const mockedPoll = vi.mocked(poll);

const ACCOUNT_ID = 123;
const PROJECT_ID = 456;
const BUILD_ID = 789;
const TARGET_PORTAL_ID = 111;

describe('lib/projects/preview', () => {
  describe('triggerAndPollPreview', () => {
    it('should trigger preview and poll until success', async () => {
      mockedTriggerAutoRelease.mockResolvedValue({
        data: {
          releaseTag: 'v1.0.0',
          status: 'SUCCESS',
          appId: 42,
        },
      } as never);

      mockedPoll.mockResolvedValue({ status: 'COMPLETE' });

      const result = await triggerAndPollPreview(
        ACCOUNT_ID,
        PROJECT_ID,
        BUILD_ID,
        TARGET_PORTAL_ID
      );

      expect(result.succeeded).toBe(true);
      expect(result.releaseTag).toBe('v1.0.0');
      expect(result.appId).toBe(42);

      expect(mockedTriggerAutoRelease).toHaveBeenCalledWith(
        ACCOUNT_ID,
        PROJECT_ID,
        BUILD_ID,
        TARGET_PORTAL_ID
      );

      expect(mockedPoll).toHaveBeenCalledWith(
        expect.any(Function),
        { successStates: ['COMPLETE'], errorStates: [] },
        expect.any(Number)
      );
    });

    it('should return succeeded false when trigger fails', async () => {
      mockedTriggerAutoRelease.mockRejectedValue(new Error('Trigger failed'));

      const result = await triggerAndPollPreview(
        ACCOUNT_ID,
        PROJECT_ID,
        BUILD_ID,
        TARGET_PORTAL_ID
      );

      expect(result.succeeded).toBe(false);
      expect(result.releaseTag).toBeUndefined();
      expect(mockedPoll).not.toHaveBeenCalled();
    });

    it('should return succeeded false when polling fails', async () => {
      mockedTriggerAutoRelease.mockResolvedValue({
        data: {
          releaseTag: 'v1.0.0',
          status: 'SUCCESS',
          appId: 42,
        },
      } as never);

      mockedPoll.mockRejectedValue(new Error('Status check failed'));

      const result = await triggerAndPollPreview(
        ACCOUNT_ID,
        PROJECT_ID,
        BUILD_ID,
        TARGET_PORTAL_ID
      );

      expect(result.succeeded).toBe(false);
      expect(result.releaseTag).toBe('v1.0.0');
      expect(result.appId).toBe(42);
    });

    it('should pass the correct callback to poll', async () => {
      mockedTriggerAutoRelease.mockResolvedValue({
        data: {
          releaseTag: 'v2.0.0',
          status: 'SUCCESS',
          appId: 99,
        },
      } as never);

      mockedPoll.mockResolvedValue({ status: 'COMPLETE' });

      await triggerAndPollPreview(
        ACCOUNT_ID,
        PROJECT_ID,
        BUILD_ID,
        TARGET_PORTAL_ID
      );

      const pollCallback = mockedPoll.mock.calls[0][0];

      mockedGetAutoReleaseStatus.mockResolvedValue({
        data: { status: 'COMPLETE', currentReleaseTag: 'v2.0.0' },
      } as never);

      await pollCallback();

      expect(mockedGetAutoReleaseStatus).toHaveBeenCalledWith(
        ACCOUNT_ID,
        PROJECT_ID,
        TARGET_PORTAL_ID,
        'v2.0.0',
        99
      );
    });
  });
});
