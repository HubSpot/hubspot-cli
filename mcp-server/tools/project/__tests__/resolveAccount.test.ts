import { resolveAccountId } from '../resolveAccount.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../../utils/logger.js';
import { Mocked } from 'vitest';
import { discoverAccountTargets } from '../../../../lib/accountTargetDiscovery.js';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';
import type { AccountTargetCandidate } from '../../../../types/AccountTargets.js';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../../../utils/logger.js');
vi.mock('../../../../lib/accountTargetDiscovery.js');
vi.mock('../../../utils/feedbackTracking');

const mockedDiscover = vi.mocked(discoverAccountTargets);

const candidate = (
  overrides: Partial<AccountTargetCandidate>
): AccountTargetCandidate => overrides as AccountTargetCandidate;

describe('mcp-server/tools/project/resolveAccount', () => {
  let mockMcpServer: Mocked<McpServer>;
  let mockLogger: Mocked<McpLogger>;

  const base = {
    toolName: 'my-tool',
    absoluteCurrentWorkingDirectory: '/cwd',
  };

  beforeEach(() => {
    mockMcpServer = {
      server: {
        getClientCapabilities: vi.fn(),
        elicitInput: vi.fn(),
      },
    } as unknown as Mocked<McpServer>;

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as Mocked<McpLogger>;

    vi.mocked(mcpFeedbackRequest).mockResolvedValue('');
  });

  it('returns the recommended account without eliciting', async () => {
    mockedDiscover.mockResolvedValue({
      candidates: [],
      recommended: candidate({ accountId: 999 }),
    });

    const result = await resolveAccountId(mockMcpServer, mockLogger, base);

    expect(result).toEqual({ accountId: 999 });
    expect(mockMcpServer.server.elicitInput).not.toHaveBeenCalled();
  });

  it('resolves a supplied account by id against the candidates', async () => {
    mockedDiscover.mockResolvedValue({
      candidates: [
        candidate({ accountId: 111 }),
        candidate({ accountId: 222 }),
      ],
      recommended: undefined,
    });

    const result = await resolveAccountId(mockMcpServer, mockLogger, {
      ...base,
      account: '222',
    });

    expect(result).toEqual({ accountId: 222 });
    expect(mockMcpServer.server.elicitInput).not.toHaveBeenCalled();
  });

  it('resolves a supplied account by name against the candidates', async () => {
    mockedDiscover.mockResolvedValue({
      candidates: [
        candidate({ accountId: 111, accountName: 'test' }),
        candidate({ accountId: 222, accountName: 'prod' }),
      ],
      recommended: undefined,
    });

    const result = await resolveAccountId(mockMcpServer, mockLogger, {
      ...base,
      account: 'test',
    });

    expect(result).toEqual({ accountId: 111 });
  });

  it('elicits an account when several exist and none is recommended', async () => {
    mockedDiscover.mockResolvedValue({
      candidates: [
        candidate({ accountId: 111 }),
        candidate({ accountId: 222 }),
      ],
      recommended: undefined,
    });
    vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({
      elicitation: { form: {} },
    });
    vi.mocked(mockMcpServer.server.elicitInput).mockResolvedValue({
      action: 'accept',
      content: { account: '222' },
    });

    const result = await resolveAccountId(mockMcpServer, mockLogger, base);

    expect(result).toEqual({ accountId: 222 });
  });

  it('returns a candidate-list response naming the tool when the client cannot elicit', async () => {
    mockedDiscover.mockResolvedValue({
      candidates: [
        candidate({ accountId: 111 }),
        candidate({ accountId: 222 }),
      ],
      recommended: undefined,
    });
    vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({});

    const result = await resolveAccountId(mockMcpServer, mockLogger, base);

    expect('response' in result).toBe(true);
    if ('response' in result) {
      const text = result.response.content.map(item => item.text).join('\n');
      expect(text).toContain('Several HubSpot accounts are available');
      expect(text).toContain('call my-tool again with the account argument');
    }
  });

  it('returns the candidate-list response when the user declines', async () => {
    mockedDiscover.mockResolvedValue({
      candidates: [
        candidate({ accountId: 111 }),
        candidate({ accountId: 222 }),
      ],
      recommended: undefined,
    });
    vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({
      elicitation: { form: {} },
    });
    vi.mocked(mockMcpServer.server.elicitInput).mockResolvedValue({
      action: 'decline',
    });

    const result = await resolveAccountId(mockMcpServer, mockLogger, base);

    expect('response' in result).toBe(true);
    if ('response' in result) {
      const text = result.response.content.map(item => item.text).join('\n');
      expect(text).toContain('Several HubSpot accounts are available');
    }
  });

  it('returns the no-account response when there are no candidates', async () => {
    mockedDiscover.mockResolvedValue({
      candidates: [],
      recommended: undefined,
    });

    const result = await resolveAccountId(mockMcpServer, mockLogger, base);

    expect('response' in result).toBe(true);
    if ('response' in result) {
      const text = result.response.content.map(item => item.text).join('\n');
      expect(text).toContain(
        'No account ID found. Call the auth-account tool to authenticate a HubSpot account.'
      );
    }
  });
});
