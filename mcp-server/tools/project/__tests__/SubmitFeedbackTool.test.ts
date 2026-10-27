import { Mocked } from 'vitest';
import { SubmitFeedbackTool } from '../SubmitFeedbackTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../../utils/logger.js';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';
import { setupHubSpotConfig } from '../../../utils/config.js';
import {
  containsAccountCredentials,
  submitFeedback,
} from '../../../../lib/feedback.js';
import { discoverAccountTargets } from '../../../../lib/accountTargetDiscovery.js';
import {
  MOCK_SANDBOX_TARGET,
  mockHubSpotHttpError,
} from '../../../../lib/testUtils.js';
import { getToolErrorMessage } from '../../../utils/errors.js';
import { getConfigCredentials } from '../../../../lib/accountCredentials.js';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../utils/logger.js');
vi.mock('../../../utils/feedbackTracking');
vi.mock('../../../utils/toolUsageTracking');
vi.mock('../../../utils/config.js');
vi.mock('../../../../lib/feedback.js');
vi.mock('../../../../lib/accountTargetDiscovery.js');
vi.mock('../../../../lib/accountCredentials.js');

const mockMcpFeedbackRequest = vi.mocked(mcpFeedbackRequest);
const mockDiscoverAccountTargets = vi.mocked(discoverAccountTargets);
const mockSetupHubSpotConfig = vi.mocked(setupHubSpotConfig);
const mockSubmitFeedback = vi.mocked(submitFeedback);
const mockContainsAccountCredentials = vi.mocked(containsAccountCredentials);

class TestSubmitFeedbackTool extends SubmitFeedbackTool {
  invokeWrapped(input: Parameters<SubmitFeedbackTool['handler']>[0]) {
    return this.wrappedHandler(input);
  }
}
const mockGetConfigCredentials = vi.mocked(getConfigCredentials);

describe('mcp-server/tools/project/SubmitFeedbackTool', () => {
  let mockMcpServer: ReturnType<typeof vi.mocked<McpServer>>;
  let mockLogger: Mocked<McpLogger>;
  let tool: TestSubmitFeedbackTool;
  let mockRegisteredTool: RegisteredTool;

  beforeEach(() => {
    mockGetConfigCredentials.mockReturnValue([]);
    // @ts-expect-error Not mocking whole server
    mockMcpServer = {
      registerTool: vi.fn(),
    };

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      runWithBuffer: vi.fn(<T>(fn: () => Promise<T>) => fn()),
      flushLogsToFile: vi.fn(),
    } as unknown as Mocked<McpLogger>;

    mockRegisteredTool = {} as RegisteredTool;
    mockMcpServer.registerTool.mockReturnValue(mockRegisteredTool);

    mockMcpFeedbackRequest.mockResolvedValue('');
    mockDiscoverAccountTargets.mockResolvedValue({
      candidates: [MOCK_SANDBOX_TARGET],
      recommended: MOCK_SANDBOX_TARGET,
    });
    mockSubmitFeedback.mockResolvedValue(undefined);
    mockContainsAccountCredentials.mockReturnValue(false);

    tool = new TestSubmitFeedbackTool(mockMcpServer, mockLogger);
  });

  describe('register', () => {
    it('should register the tool', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'submit-feedback',
        expect.objectContaining({
          title: 'Submit Feedback',
          description: expect.stringContaining('Sends feedback to HubSpot'),
          inputSchema: expect.any(Object),
        }),
        expect.any(Function)
      );
      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('handler', () => {
    const mockInput = {
      absoluteCurrentWorkingDirectory: '/foo',
      feedback: 'get-build-logs returned no logs for a failed build',
      source: 'agent' as const,
    };

    it('should send the feedback with the resolved account', async () => {
      const result = await tool.handler(mockInput);

      expect(mockSetupHubSpotConfig).toHaveBeenCalledWith('/foo');
      expect(mockSubmitFeedback).toHaveBeenCalledWith(
        MOCK_SANDBOX_TARGET.accountId,
        'get-build-logs returned no logs for a failed build',
        'agent'
      );
      expect(result.content[0].text).toBe(
        'Your feedback has been successfully submitted. Tell the user that you sent feedback, and show them the message.'
      );
    });

    it('should log the feedback length instead of the feedback', async () => {
      await tool.invokeWrapped(mockInput);

      expect(mockLogger.debug).toHaveBeenCalledWith('submit-feedback', {
        message: 'Tool invoked',
        args: {
          absoluteCurrentWorkingDirectory: '/foo',
          source: 'agent',
          feedbackLength: mockInput.feedback.length,
        },
      });
      expect(JSON.stringify(mockLogger.debug.mock.calls)).not.toContain(
        mockInput.feedback
      );
    });

    it('should return auth error message when no account ID is found', async () => {
      mockDiscoverAccountTargets.mockResolvedValue({
        candidates: [],
        recommended: undefined,
      });

      const result = await tool.handler(mockInput);

      expect(mockSubmitFeedback).not.toHaveBeenCalled();
      expect(result.content[0].text).toBe(
        'No account ID found. Call the auth-account tool to authenticate a HubSpot account.'
      );
    });

    it('should not send feedback that contains config credentials', async () => {
      mockContainsAccountCredentials.mockReturnValue(true);

      const result = await tool.handler(mockInput);

      expect(mockContainsAccountCredentials).toHaveBeenCalledWith(
        mockInput.feedback
      );
      expect(mockSubmitFeedback).not.toHaveBeenCalled();
      expect(result.content[0].text).toBe(
        'Feedback cannot contain an access key, token, or secret from your HubSpot config. Remove it, then try again.'
      );
    });

    it('should redact config credentials from HubSpot HTTP errors', async () => {
      const mockError = mockHubSpotHttpError(
        'Unauthorized',
        { status: 401, data: { message: 'The access key is missing scopes.' } },
        {
          url: 'localdevauth/v1/auth/refresh',
          data: '{"encodedOAuthRefreshToken":"pak-secret"}',
        }
      );
      mockGetConfigCredentials.mockReturnValue(['pak-secret']);
      mockSubmitFeedback.mockRejectedValue(mockError);

      const result = await tool.handler(mockInput);

      expect(result.content[0].text).toBe(
        `Error sending feedback: ${getToolErrorMessage(mockError)}`
      );
      expect(result.content[0].text).not.toContain('pak-secret');
    });

    it('should handle other errors', async () => {
      mockSubmitFeedback.mockRejectedValue(new Error('Network error'));

      const result = await tool.handler(mockInput);

      expect(result.content[0].text).toBe(
        'Error sending feedback: Network error'
      );
    });
  });
});
