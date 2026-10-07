import {
  confirmProductionTargets,
  setTargetAccount,
} from '../productionConfirmation.js';
import { HubSpotCommand } from '../../../utils/command.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Mocked } from 'vitest';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';
import { McpLogger } from '../../../utils/logger.js';
import { getConfigAccountIfExists } from '@hubspot/local-dev-lib/config';
import { MCP_ELICITATION_TIMEOUT } from '../../../../lib/constants.js';
import {
  MOCK_PRODUCTION_TARGET,
  getMockConfigAccount,
} from '../../../../lib/testUtils.js';
import {
  ACCOUNT_TARGET_CATEGORIES,
  ACCOUNT_TARGET_SELECTION_SOURCES,
  AccountTargetCandidate,
} from '../../../../types/AccountTargets.js';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../utils/feedbackTracking');
vi.mock('../../../utils/logger.js');
vi.mock('@hubspot/local-dev-lib/config');

const unnamedProductionAccount: AccountTargetCandidate = {
  accountId: 444,
  source: ACCOUNT_TARGET_SELECTION_SOURCES.LINKED_DIRECTORY,
  category: ACCOUNT_TARGET_CATEGORIES.PRODUCTION_WITH_CARE,
};

const sandboxAccount: AccountTargetCandidate = {
  accountId: 222,
  accountName: 'Sandbox',
  source: ACCOUNT_TARGET_SELECTION_SOURCES.LINKED_DIRECTORY,
  category: ACCOUNT_TARGET_CATEGORIES.RECOMMENDED_TESTING,
};

const baseOptions = {
  action: 'Deploy build #7',
  toolName: 'deploy-project',
  targets: {
    candidates: [MOCK_PRODUCTION_TARGET],
    recommended: MOCK_PRODUCTION_TARGET,
  },
};

const declinedResponse = {
  content: [
    {
      type: 'text',
      text: 'The user did not confirm production account Prod Portal [standard] (111), so deploy-project did not run. Tell the user that the action was canceled. Do not ask the user to confirm again, and do not call deploy-project again unless the user asks.',
    },
  ],
  isError: true,
};

describe('mcp-server/tools/project/productionConfirmation', () => {
  let mockMcpServer: Mocked<McpServer>;
  let mockLogger: Mocked<McpLogger>;

  beforeEach(() => {
    mockMcpServer = {
      server: {
        getClientCapabilities: vi.fn(),
        elicitInput: vi.fn(),
      },
    } as unknown as Mocked<McpServer>;
    mockLogger = { warn: vi.fn() } as unknown as Mocked<McpLogger>;
    vi.mocked(mcpFeedbackRequest).mockResolvedValue('');
    vi.mocked(getConfigAccountIfExists).mockImplementation(
      getMockConfigAccount
    );
    vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({
      elicitation: { form: {} },
    });
  });

  it('does not ask when the recommended account is not a production account', async () => {
    const result = await confirmProductionTargets(mockMcpServer, mockLogger, {
      ...baseOptions,
      targets: {
        candidates: [MOCK_PRODUCTION_TARGET, sandboxAccount],
        recommended: sandboxAccount,
      },
    });

    expect(result).toBeUndefined();
    expect(mockMcpServer.server.elicitInput).not.toHaveBeenCalled();
  });

  it('lets the action run when the user confirms', async () => {
    vi.mocked(mockMcpServer.server.elicitInput).mockResolvedValue({
      action: 'accept',
      content: {},
    });

    const result = await confirmProductionTargets(
      mockMcpServer,
      mockLogger,
      baseOptions
    );

    expect(result).toBeUndefined();
    expect(mockMcpServer.server.elicitInput).toHaveBeenCalledTimes(1);
    expect(mockMcpServer.server.elicitInput).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Deploy build #7 to production account Prod Portal [standard] (111)?',
      }),
      { timeout: MCP_ELICITATION_TIMEOUT }
    );
  });

  it('names every production candidate when there is no recommended account', async () => {
    vi.mocked(mockMcpServer.server.elicitInput).mockResolvedValue({
      action: 'accept',
      content: {},
    });

    await confirmProductionTargets(mockMcpServer, mockLogger, {
      ...baseOptions,
      targets: {
        candidates: [
          sandboxAccount,
          MOCK_PRODUCTION_TARGET,
          unnamedProductionAccount,
        ],
      },
    });

    expect(mockMcpServer.server.elicitInput).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Deploy build #7 to production account Prod Portal [standard] (111) or 444?',
      }),
      expect.anything()
    );
  });

  it('blocks the action when the user declines, even when the agent set the confirmation flag', async () => {
    vi.mocked(mockMcpServer.server.elicitInput).mockResolvedValue({
      action: 'decline',
    });

    const result = await confirmProductionTargets(mockMcpServer, mockLogger, {
      ...baseOptions,
      confirmedInConversation: true,
    });

    expect(result).toEqual(declinedResponse);
  });

  it('blocks the action when the form times out, even when the agent set the confirmation flag', async () => {
    vi.mocked(mockMcpServer.server.elicitInput).mockRejectedValue(
      new Error('Request timed out')
    );

    const result = await confirmProductionTargets(mockMcpServer, mockLogger, {
      ...baseOptions,
      confirmedInConversation: true,
    });

    expect(result).toEqual(declinedResponse);
  });

  it('asks the agent to confirm in the conversation when the client cannot elicit', async () => {
    vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({});

    const result = await confirmProductionTargets(
      mockMcpServer,
      mockLogger,
      baseOptions
    );

    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'Deploy build #7 targets production account Prod Portal [standard] (111), which is not a test account or sandbox. Ask the user to confirm this account. If the user confirms, call deploy-project again with confirmProductionAccount set to true.',
        },
      ],
      isError: true,
    });
  });

  it('lets the action run when the client cannot elicit and the agent set the confirmation flag', async () => {
    vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({});

    const result = await confirmProductionTargets(mockMcpServer, mockLogger, {
      ...baseOptions,
      confirmedInConversation: true,
    });

    expect(result).toBeUndefined();
  });

  describe('setTargetAccount', () => {
    it('pins the recommended account', () => {
      const command = new HubSpotCommand('project upload');

      setTargetAccount(command, {
        candidates: [MOCK_PRODUCTION_TARGET],
        recommended: MOCK_PRODUCTION_TARGET,
      });

      expect(command.args).toEqual(['project', 'upload', '--account', '111']);
    });

    it('pins the profile instead of the account when a profile is given', () => {
      const command = new HubSpotCommand('project upload');

      setTargetAccount(
        command,
        {
          candidates: [MOCK_PRODUCTION_TARGET],
          recommended: MOCK_PRODUCTION_TARGET,
        },
        'prod'
      );

      expect(command.args).toEqual(['project', 'upload', '--profile', 'prod']);
    });

    it('adds nothing when there is no recommended account', () => {
      const command = new HubSpotCommand('project upload');

      setTargetAccount(command, { candidates: [MOCK_PRODUCTION_TARGET] });

      expect(command.args).toEqual(['project', 'upload']);
    });
  });
});
