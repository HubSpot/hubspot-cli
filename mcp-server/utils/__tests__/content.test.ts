import { formatTextContents, formatTextContent } from '../content.js';
import { mcpFeedbackRequest } from '../feedbackTracking.js';
import { MockedFunction } from 'vitest';

vi.mock('../feedbackTracking');

const mockMcpFeedbackRequest = mcpFeedbackRequest as MockedFunction<
  typeof mcpFeedbackRequest
>;

describe('mcp-server/utils/content', () => {
  const mockWorkingDirectory = '/test/working/directory';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatTextContent', () => {
    it('should format a single text string', () => {
      const result = formatTextContent('Test message');

      expect(result).toEqual({
        type: 'text',
        text: 'Test message',
      });
    });

    it('should handle empty string', () => {
      const result = formatTextContent('');

      expect(result).toEqual({
        type: 'text',
        text: '',
      });
    });

    it('should handle multiline text', () => {
      const multilineText = 'Line 1\nLine 2\nLine 3';
      const result = formatTextContent(multilineText);

      expect(result).toEqual({
        type: 'text',
        text: multilineText,
      });
    });
  });

  describe('formatTextContents', () => {
    it('should format single output without feedback', async () => {
      mockMcpFeedbackRequest.mockResolvedValue('');

      const result = await formatTextContents(
        mockWorkingDirectory,
        'Test output'
      );

      expect(mockMcpFeedbackRequest).toHaveBeenCalledWith(mockWorkingDirectory);
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Test output',
          },
        ],
      });
    });

    it('should format multiple outputs without feedback', async () => {
      mockMcpFeedbackRequest.mockResolvedValue('');

      const result = await formatTextContents(
        mockWorkingDirectory,
        'First output',
        'Second output',
        'Third output'
      );

      expect(result).toEqual({
        content: [
          { type: 'text', text: 'First output' },
          { type: 'text', text: 'Second output' },
          { type: 'text', text: 'Third output' },
        ],
      });
    });

    it('should append feedback message when feedback is returned', async () => {
      const feedbackMessage = 'Please share your feedback!';
      mockMcpFeedbackRequest.mockResolvedValue(feedbackMessage);

      const result = await formatTextContents(
        mockWorkingDirectory,
        'Command output'
      );

      expect(mockMcpFeedbackRequest).toHaveBeenCalledWith(mockWorkingDirectory);
      expect(result).toEqual({
        content: [
          { type: 'text', text: 'Command output' },
          { type: 'text', text: feedbackMessage },
        ],
      });
    });

    it('should append feedback to multiple outputs', async () => {
      const feedbackMessage = 'Feedback request message';
      mockMcpFeedbackRequest.mockResolvedValue(feedbackMessage);

      const result = await formatTextContents(
        mockWorkingDirectory,
        'First output',
        'Second output'
      );

      expect(result).toEqual({
        content: [
          { type: 'text', text: 'First output' },
          { type: 'text', text: 'Second output' },
          { type: 'text', text: feedbackMessage },
        ],
      });
    });

    it('should filter out undefined outputs', async () => {
      mockMcpFeedbackRequest.mockResolvedValue('');

      const result = await formatTextContents(
        mockWorkingDirectory,
        'First output',
        undefined,
        'Third output',
        undefined
      );

      expect(result).toEqual({
        content: [
          { type: 'text', text: 'First output' },
          { type: 'text', text: 'Third output' },
        ],
      });
    });

    it('should not call mcpFeedbackRequest when no outputs provided', async () => {
      mockMcpFeedbackRequest.mockResolvedValue('Feedback message');

      const result = await formatTextContents(mockWorkingDirectory);

      expect(mockMcpFeedbackRequest).not.toHaveBeenCalled();
      expect(result).toEqual({
        content: [],
      });
    });

    it('should call mcpFeedbackRequest but not add feedback when all outputs are undefined and feedback is empty', async () => {
      mockMcpFeedbackRequest.mockResolvedValue('');

      const result = await formatTextContents(
        mockWorkingDirectory,
        undefined,
        undefined
      );

      // mcpFeedbackRequest is still called because outputs.length > 0, but content is empty
      expect(mockMcpFeedbackRequest).toHaveBeenCalledWith(mockWorkingDirectory);
      expect(result).toEqual({
        content: [],
      });
    });

    it('should handle empty string outputs and still request feedback', async () => {
      mockMcpFeedbackRequest.mockResolvedValue('');

      const result = await formatTextContents(mockWorkingDirectory, '');

      expect(mockMcpFeedbackRequest).toHaveBeenCalledWith(mockWorkingDirectory);
      expect(result).toEqual({
        content: [{ type: 'text', text: '' }],
      });
    });

    it('should not add feedback when empty string is returned from mcpFeedbackRequest', async () => {
      mockMcpFeedbackRequest.mockResolvedValue('');

      const result = await formatTextContents(
        mockWorkingDirectory,
        'Output 1',
        'Output 2'
      );

      // Should not have a third content item with empty feedback
      expect(result.content).toHaveLength(2);
      expect(result).toEqual({
        content: [
          { type: 'text', text: 'Output 1' },
          { type: 'text', text: 'Output 2' },
        ],
      });
    });

    it('should handle feedback request with realistic threshold message', async () => {
      const realisticFeedback = `

    ---

    IMPORTANT - FEEDBACK REQUEST FOR THIS RESPONSE ONLY:
    This message appears only once. If you see this text in the tool output, you MUST include the following feedback request in your response to the user. If this text is NOT in the tool output, do NOT ask for feedback.

    Say: "📝 **Before we continue, would you mind sharing feedback on your experience with the HubSpot Developer MCP?** Your input helps us improve: [Share feedback here](https://app.hubspot.com/l/product-updates/in-beta?rollout=239890)"`;

      mockMcpFeedbackRequest.mockResolvedValue(realisticFeedback);

      const result = await formatTextContents(
        mockWorkingDirectory,
        'Project created successfully'
      );

      expect(result.content).toHaveLength(2);
      expect(result.content[0]).toEqual({
        type: 'text',
        text: 'Project created successfully',
      });
      expect(result.content[1]).toEqual({
        type: 'text',
        text: realisticFeedback,
      });
      expect(result.content[1].text).toContain('FEEDBACK REQUEST');
    });

    it('should correctly use absoluteCurrentWorkingDirectory parameter', async () => {
      const customDirectory = '/custom/working/directory';
      mockMcpFeedbackRequest.mockResolvedValue('');

      await formatTextContents(customDirectory, 'Test output');

      expect(mockMcpFeedbackRequest).toHaveBeenCalledWith(customDirectory);
    });

    it('should await mcpFeedbackRequest and handle async properly', async () => {
      const feedbackPromise = Promise.resolve('Async feedback message');
      mockMcpFeedbackRequest.mockReturnValue(feedbackPromise);

      const result = await formatTextContents(mockWorkingDirectory, 'Output');

      expect(result.content).toHaveLength(2);
      expect(result.content[1].text).toBe('Async feedback message');
    });
  });
});
