import {
  updateAllowUsageTracking,
  updateAllowAutoUpdates,
  updateDefaultCmsPublishMode,
  updateHttpTimeout,
  updateAutoOpenBrowser,
} from '@hubspot/local-dev-lib/config';
import { CmsPublishMode } from '@hubspot/local-dev-lib/types/Files';
import {
  setAllowUsageTracking,
  setAllowAutoUpdates,
  setDefaultCmsPublishMode,
  setHttpTimeout,
  setAutoOpenBrowser,
} from '../configOptions.js';
import { trackCommandUsage } from '../usageTracking.js';
import { listPrompt, promptUser } from '../prompts/promptUtils.js';

vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../prompts/promptUtils.js');

const mockUpdateAllowUsageTracking = vi.mocked(updateAllowUsageTracking);
const mockUpdateAllowAutoUpdates = vi.mocked(updateAllowAutoUpdates);
const mockUpdateDefaultCmsPublishMode = vi.mocked(updateDefaultCmsPublishMode);
const mockUpdateHttpTimeout = vi.mocked(updateHttpTimeout);
const mockUpdateAutoOpenBrowser = vi.mocked(updateAutoOpenBrowser);
const mockListPrompt = vi.mocked(listPrompt);
const mockPromptUser = vi.mocked(promptUser);

const accountId = 123456;

describe('lib/configOptions', () => {
  describe('setAllowUsageTracking', () => {
    it('updates the config with the provided value and returns it', async () => {
      const result = await setAllowUsageTracking({
        accountId,
        allowUsageTracking: false,
      });

      expect(mockUpdateAllowUsageTracking).toHaveBeenCalledWith(false);
      expect(result).toBe(false);
    });

    it('prompts when no value is provided and returns the choice', async () => {
      mockListPrompt.mockResolvedValue(true as never);

      const result = await setAllowUsageTracking({ accountId });

      expect(mockListPrompt).toHaveBeenCalledTimes(1);
      expect(mockUpdateAllowUsageTracking).toHaveBeenCalledWith(true);
      expect(result).toBe(true);
    });

    it('does not track usage', async () => {
      await setAllowUsageTracking({ accountId, allowUsageTracking: true });

      expect(trackCommandUsage).not.toHaveBeenCalled();
    });
  });

  describe('setAllowAutoUpdates', () => {
    it('updates the config with the provided value and returns it', async () => {
      const result = await setAllowAutoUpdates({
        accountId,
        allowAutoUpdates: true,
      });

      expect(mockUpdateAllowAutoUpdates).toHaveBeenCalledWith(true);
      expect(result).toBe(true);
    });

    it('prompts when no value is provided and returns the choice', async () => {
      mockListPrompt.mockResolvedValue(false as never);

      const result = await setAllowAutoUpdates({ accountId });

      expect(mockListPrompt).toHaveBeenCalledTimes(1);
      expect(mockUpdateAllowAutoUpdates).toHaveBeenCalledWith(false);
      expect(result).toBe(false);
    });

    it('does not track usage', async () => {
      await setAllowAutoUpdates({ accountId, allowAutoUpdates: false });

      expect(trackCommandUsage).not.toHaveBeenCalled();
    });
  });

  describe('setDefaultCmsPublishMode', () => {
    it('updates the config with a valid mode and returns it', async () => {
      const result = await setDefaultCmsPublishMode({
        accountId,
        defaultCmsPublishMode: 'draft' as CmsPublishMode,
      });

      expect(mockUpdateDefaultCmsPublishMode).toHaveBeenCalledWith('draft');
      expect(result).toBe('draft');
    });

    it('prompts when no mode is provided and returns the choice', async () => {
      mockListPrompt.mockResolvedValue('publish' as never);

      const result = await setDefaultCmsPublishMode({ accountId });

      expect(mockListPrompt).toHaveBeenCalledTimes(1);
      expect(mockUpdateDefaultCmsPublishMode).toHaveBeenCalledWith('publish');
      expect(result).toBe('publish');
    });

    it('prompts when an invalid mode is provided', async () => {
      mockListPrompt.mockResolvedValue('draft' as never);

      const result = await setDefaultCmsPublishMode({
        accountId,
        defaultCmsPublishMode: 'invalid' as CmsPublishMode,
      });

      expect(mockUiLogger.error).toHaveBeenCalledTimes(1);
      expect(mockListPrompt).toHaveBeenCalledTimes(1);
      expect(result).toBe('draft');
    });

    it('does not track usage', async () => {
      await setDefaultCmsPublishMode({
        accountId,
        defaultCmsPublishMode: 'draft' as CmsPublishMode,
      });

      expect(trackCommandUsage).not.toHaveBeenCalled();
    });
  });

  describe('setHttpTimeout', () => {
    it('updates the config with the provided value and returns it', async () => {
      const result = await setHttpTimeout({ accountId, httpTimeout: '5000' });

      expect(mockUpdateHttpTimeout).toHaveBeenCalledWith('5000');
      expect(result).toBe('5000');
    });

    it('prompts when no value is provided and returns the entered value', async () => {
      mockPromptUser.mockResolvedValue({ timeout: '9000' } as never);

      const result = await setHttpTimeout({ accountId });

      expect(mockPromptUser).toHaveBeenCalledTimes(1);
      expect(mockUpdateHttpTimeout).toHaveBeenCalledWith('9000');
      expect(result).toBe('9000');
    });

    it('does not track usage', async () => {
      await setHttpTimeout({ accountId, httpTimeout: '5000' });

      expect(trackCommandUsage).not.toHaveBeenCalled();
    });
  });

  describe('setAutoOpenBrowser', () => {
    it('updates the config with the provided value and returns it', async () => {
      const result = await setAutoOpenBrowser({
        accountId,
        autoOpenBrowser: true,
      });

      expect(mockUpdateAutoOpenBrowser).toHaveBeenCalledWith(true);
      expect(result).toBe(true);
    });

    it('does not track usage', async () => {
      await setAutoOpenBrowser({ accountId, autoOpenBrowser: false });

      expect(trackCommandUsage).not.toHaveBeenCalled();
    });
  });
});
