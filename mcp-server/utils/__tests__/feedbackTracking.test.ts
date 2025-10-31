import { mcpFeedbackRequest } from '../feedbackTracking.js';
import {
  getStateValue,
  setStateValue,
} from '@hubspot/local-dev-lib/config/state';
import { getAccountIdFromCliConfig } from '../cliConfig.js';
import { hasFeature } from '../../../lib/hasFeature.js';
import { FEATURES } from '../../../lib/constants.js';
import { MockedFunction } from 'vitest';

vi.mock('@hubspot/local-dev-lib/config/state');
vi.mock('../cliConfig');
vi.mock('../../../lib/hasFeature');
vi.mock('../../../lib/errorHandlers/index');

const mockGetStateValue = getStateValue as MockedFunction<typeof getStateValue>;
const mockSetStateValue = setStateValue as MockedFunction<typeof setStateValue>;
const mockGetAccountIdFromCliConfig =
  getAccountIdFromCliConfig as MockedFunction<typeof getAccountIdFromCliConfig>;
const mockHasFeature = hasFeature as MockedFunction<typeof hasFeature>;

describe('mcp-server/utils/feedbackTracking', () => {
  const mockWorkingDirectory = '/test/working/directory';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mcpFeedbackRequest', () => {
    it('should return empty string when not at a threshold', async () => {
      mockGetStateValue.mockReturnValue(10);

      const result = await mcpFeedbackRequest(mockWorkingDirectory);

      expect(mockSetStateValue).toHaveBeenCalledWith('mcpTotalToolCalls', 11);
      expect(result).toBe(undefined);
    });

    it('should return feedback message at threshold 50', async () => {
      mockGetStateValue.mockReturnValue(49);
      mockGetAccountIdFromCliConfig.mockReturnValue(null);

      const result = await mcpFeedbackRequest(mockWorkingDirectory);

      expect(mockSetStateValue).toHaveBeenCalledWith('mcpTotalToolCalls', 50);
      expect(result).toContain('FEEDBACK REQUEST');
      expect(result).toContain(
        'https://app.hubspot.com/l/product-updates/in-beta?rollout=239890'
      );
    });

    it('should return feedback message at threshold 250', async () => {
      mockGetStateValue.mockReturnValue(249);
      mockGetAccountIdFromCliConfig.mockReturnValue(null);

      const result = await mcpFeedbackRequest(mockWorkingDirectory);

      expect(mockSetStateValue).toHaveBeenCalledWith('mcpTotalToolCalls', 250);
      expect(result).toContain('FEEDBACK REQUEST');
    });

    it('should return feedback message at threshold 550', async () => {
      mockGetStateValue.mockReturnValue(549);
      mockGetAccountIdFromCliConfig.mockReturnValue(null);

      const result = await mcpFeedbackRequest(mockWorkingDirectory);

      expect(mockSetStateValue).toHaveBeenCalledWith('mcpTotalToolCalls', 550);
      expect(result).toContain('FEEDBACK REQUEST');
    });

    it('should return feedback message at threshold 1050', async () => {
      mockGetStateValue.mockReturnValue(1049);
      mockGetAccountIdFromCliConfig.mockReturnValue(null);

      const result = await mcpFeedbackRequest(mockWorkingDirectory);

      expect(mockSetStateValue).toHaveBeenCalledWith('mcpTotalToolCalls', 1050);
      expect(result).toContain('FEEDBACK REQUEST');
    });

    it('should use account-specific URL when account has MCP access', async () => {
      const accountId = 12345;
      mockGetStateValue.mockReturnValue(49);
      mockGetAccountIdFromCliConfig.mockReturnValue(accountId);
      mockHasFeature.mockResolvedValue(true);

      const result = await mcpFeedbackRequest(mockWorkingDirectory);

      expect(mockGetAccountIdFromCliConfig).toHaveBeenCalledWith(
        mockWorkingDirectory
      );
      expect(mockHasFeature).toHaveBeenCalledWith(
        accountId,
        FEATURES.MCP_ACCESS
      );
      expect(result).toContain(
        `https://app.hubspot.com/product-updates/${accountId}/in-beta?rollout=239890`
      );
    });

    it('should use default URL when account does not have MCP access', async () => {
      const accountId = 12345;
      mockGetStateValue.mockReturnValue(49);
      mockGetAccountIdFromCliConfig.mockReturnValue(accountId);
      mockHasFeature.mockResolvedValue(false);

      const result = await mcpFeedbackRequest(mockWorkingDirectory);

      expect(mockHasFeature).toHaveBeenCalledWith(
        accountId,
        FEATURES.MCP_ACCESS
      );
      expect(result).toContain(
        'https://app.hubspot.com/l/product-updates/in-beta?rollout=239890'
      );
      expect(result).not.toContain(`/product-updates/${accountId}/`);
    });

    it('should use default URL when no account ID is found', async () => {
      mockGetStateValue.mockReturnValue(49);
      mockGetAccountIdFromCliConfig.mockReturnValue(null);

      const result = await mcpFeedbackRequest(mockWorkingDirectory);

      expect(mockGetAccountIdFromCliConfig).toHaveBeenCalledWith(
        mockWorkingDirectory
      );
      expect(mockHasFeature).not.toHaveBeenCalled();
      expect(result).toContain(
        'https://app.hubspot.com/l/product-updates/in-beta?rollout=239890'
      );
    });

    it('should handle errors gracefully and return empty string', async () => {
      mockGetStateValue.mockImplementation(() => {
        throw new Error('State error');
      });

      const result = await mcpFeedbackRequest(mockWorkingDirectory);

      expect(result).toBe(undefined);
    });

    it('should handle hasFeature errors and use default URL', async () => {
      const accountId = 12345;
      mockGetStateValue.mockReturnValue(49);
      mockGetAccountIdFromCliConfig.mockReturnValue(accountId);
      mockHasFeature.mockRejectedValue(new Error('Feature check failed'));

      const result = await mcpFeedbackRequest(mockWorkingDirectory);

      expect(result).toContain(
        'https://app.hubspot.com/l/product-updates/in-beta?rollout=239890'
      );
      expect(result).not.toContain(`/product-updates/${accountId}/`);
    });

    it('should not return feedback at threshold + 1', async () => {
      mockGetStateValue.mockReturnValue(50);

      const result = await mcpFeedbackRequest(mockWorkingDirectory);

      expect(mockSetStateValue).toHaveBeenCalledWith('mcpTotalToolCalls', 51);
      expect(result).toBe(undefined);
    });

    it('should increment tool calls counter on every invocation', async () => {
      const initialCount = 100;
      mockGetStateValue.mockReturnValue(initialCount);

      await mcpFeedbackRequest(mockWorkingDirectory);

      expect(mockGetStateValue).toHaveBeenCalledWith('mcpTotalToolCalls');
      expect(mockSetStateValue).toHaveBeenCalledWith(
        'mcpTotalToolCalls',
        initialCount + 1
      );
    });

    it('should include feedback request instructions in message', async () => {
      mockGetStateValue.mockReturnValue(49);
      mockGetAccountIdFromCliConfig.mockReturnValue(null);

      const result = await mcpFeedbackRequest(mockWorkingDirectory);

      expect(result).toContain('IMPORTANT - FEEDBACK REQUEST');
      expect(result).toContain('This message appears only once');
      expect(result).toContain('Share feedback here');
    });
  });
});
