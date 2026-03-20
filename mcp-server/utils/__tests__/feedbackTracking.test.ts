import { mcpFeedbackRequest } from '../feedbackTracking.js';
import {
  getStateValue,
  setStateValue,
} from '@hubspot/local-dev-lib/config/state';
import { MockedFunction } from 'vitest';
import { FEEDBACK_URL } from '../../../lib/constants.js';

vi.mock('@hubspot/local-dev-lib/config/state');
vi.mock('@hubspot/local-dev-lib/logger');

const mockGetStateValue = getStateValue as MockedFunction<typeof getStateValue>;
const mockSetStateValue = setStateValue as MockedFunction<typeof setStateValue>;

describe('mcp-server/utils/feedbackTracking', () => {
  describe('mcpFeedbackRequest', () => {
    it('should return empty string when not at a threshold', async () => {
      mockGetStateValue.mockReturnValue(10);

      const result = await mcpFeedbackRequest();

      expect(mockSetStateValue).toHaveBeenCalledWith('mcpTotalToolCalls', 11);
      expect(result).toBe(undefined);
    });

    it('should return feedback message at threshold 50', async () => {
      mockGetStateValue.mockReturnValue(49);

      const result = await mcpFeedbackRequest();

      expect(mockSetStateValue).toHaveBeenCalledWith('mcpTotalToolCalls', 50);
      expect(result).toContain('FEEDBACK REQUEST');
      expect(result).toContain(FEEDBACK_URL);
    });

    it('should return feedback message at threshold 250', async () => {
      mockGetStateValue.mockReturnValue(249);

      const result = await mcpFeedbackRequest();

      expect(mockSetStateValue).toHaveBeenCalledWith('mcpTotalToolCalls', 250);
      expect(result).toContain('FEEDBACK REQUEST');
    });

    it('should return feedback message at threshold 550', async () => {
      mockGetStateValue.mockReturnValue(549);

      const result = await mcpFeedbackRequest();

      expect(mockSetStateValue).toHaveBeenCalledWith('mcpTotalToolCalls', 550);
      expect(result).toContain('FEEDBACK REQUEST');
    });

    it('should return feedback message at threshold 1050', async () => {
      mockGetStateValue.mockReturnValue(1049);

      const result = await mcpFeedbackRequest();

      expect(mockSetStateValue).toHaveBeenCalledWith('mcpTotalToolCalls', 1050);
      expect(result).toContain('FEEDBACK REQUEST');
    });

    it('should not return feedback at threshold + 1', async () => {
      mockGetStateValue.mockReturnValue(50);

      const result = await mcpFeedbackRequest();

      expect(mockSetStateValue).toHaveBeenCalledWith('mcpTotalToolCalls', 51);
      expect(result).toBe(undefined);
    });

    it('should increment tool calls counter on every invocation', async () => {
      const initialCount = 100;
      mockGetStateValue.mockReturnValue(initialCount);

      await mcpFeedbackRequest();

      expect(mockGetStateValue).toHaveBeenCalledWith('mcpTotalToolCalls');
      expect(mockSetStateValue).toHaveBeenCalledWith(
        'mcpTotalToolCalls',
        initialCount + 1
      );
    });

    it('should include feedback request instructions in message', async () => {
      mockGetStateValue.mockReturnValue(49);

      const result = await mcpFeedbackRequest();

      expect(result).toContain('IMPORTANT - FEEDBACK REQUEST');
      expect(result).toContain('This message appears only once');
      expect(result).toContain('Share feedback here');
    });

    it('should handle errors gracefully and return undefined', async () => {
      mockGetStateValue.mockImplementation(() => {
        throw new Error('State error');
      });

      const result = await mcpFeedbackRequest();

      expect(result).toBe(undefined);
    });
  });
});
