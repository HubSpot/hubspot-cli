import { elicitSelection } from '../elicitSelection.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../logger.js';
import { Mocked } from 'vitest';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../logger.js');

describe('mcp-server/utils/elicitSelection', () => {
  let mockMcpServer: Mocked<McpServer>;
  let mockLogger: Mocked<McpLogger>;

  const base = { message: 'Pick one', title: 'Thing' };

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
  });

  it('returns undefined for an empty list without eliciting', async () => {
    const result = await elicitSelection(mockMcpServer, mockLogger, {
      ...base,
      options: [],
    });

    expect(result).toBeUndefined();
    expect(mockMcpServer.server.elicitInput).not.toHaveBeenCalled();
  });

  it('auto-selects the only option without eliciting', async () => {
    const result = await elicitSelection(mockMcpServer, mockLogger, {
      ...base,
      options: [{ value: 'only', label: 'The only one' }],
    });

    expect(result).toBe('only');
    expect(mockMcpServer.server.elicitInput).not.toHaveBeenCalled();
  });

  it('returns the elicited value when several options exist', async () => {
    vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({
      elicitation: { form: {} },
    });
    vi.mocked(mockMcpServer.server.elicitInput).mockResolvedValue({
      action: 'accept',
      content: { selection: 'b' },
    });

    const result = await elicitSelection(mockMcpServer, mockLogger, {
      ...base,
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    });

    expect(result).toBe('b');
  });

  it('returns undefined when the client cannot elicit', async () => {
    vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({});

    const result = await elicitSelection(mockMcpServer, mockLogger, {
      ...base,
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    });

    expect(result).toBeUndefined();
  });

  it('returns undefined when the user declines', async () => {
    vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({
      elicitation: { form: {} },
    });
    vi.mocked(mockMcpServer.server.elicitInput).mockResolvedValue({
      action: 'decline',
    });

    const result = await elicitSelection(mockMcpServer, mockLogger, {
      ...base,
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    });

    expect(result).toBeUndefined();
  });
});
