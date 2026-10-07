import { booleanField, enumField, requestElicitation } from '../elicitation.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ElicitRequestFormParams } from '@modelcontextprotocol/sdk/types.js';
import { McpLogger } from '../logger.js';
import { MCP_ELICITATION_TIMEOUT } from '../../../lib/constants.js';
import { Mocked } from 'vitest';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../logger.js');

describe('mcp-server/utils/elicitation', () => {
  let mockMcpServer: Mocked<McpServer>;
  let mockLogger: Mocked<McpLogger>;

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

  it('returns undefined and never elicits when the client lacks form elicitation', async () => {
    vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({});

    const result = await requestElicitation(mockMcpServer, {
      message: 'need input',
      fields: { name: { type: 'string' } },
    });

    expect(result).toBeUndefined();
    expect(mockMcpServer.server.elicitInput).not.toHaveBeenCalled();
  });

  it('builds a requestedSchema with primitive fields', async () => {
    vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({
      elicitation: { form: {} },
    });
    vi.mocked(mockMcpServer.server.elicitInput).mockResolvedValue({
      action: 'accept',
      content: {},
    });

    await requestElicitation(mockMcpServer, {
      message: 'need input',
      fields: {
        name: { type: 'string', description: 'the name' },
        count: { type: 'number', minimum: 1 },
        color: {
          type: 'string',
          enum: ['red', 'blue'],
          enumNames: ['Red', 'Blue'],
        },
      },
      required: ['name'],
    });

    const callArg = vi.mocked(mockMcpServer.server.elicitInput).mock
      .calls[0][0] as ElicitRequestFormParams;

    expect(callArg.message).toBe('need input');
    expect(
      vi.mocked(mockMcpServer.server.elicitInput).mock.calls[0][1]
    ).toEqual({ timeout: MCP_ELICITATION_TIMEOUT });
    expect(callArg.requestedSchema.type).toBe('object');
    expect(callArg.requestedSchema.required).toEqual(['name']);
    expect(callArg.requestedSchema.properties.name).toEqual({
      type: 'string',
      description: 'the name',
    });
    expect(callArg.requestedSchema.properties.count).toEqual({
      type: 'number',
      minimum: 1,
    });
    expect(callArg.requestedSchema.properties.color).toEqual({
      type: 'string',
      enum: ['red', 'blue'],
      enumNames: ['Red', 'Blue'],
    });
  });

  it('returns the accept result with its content', async () => {
    vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({
      elicitation: { form: {} },
    });
    vi.mocked(mockMcpServer.server.elicitInput).mockResolvedValue({
      action: 'accept',
      content: { name: 'my-project' },
    });

    const result = await requestElicitation(mockMcpServer, {
      message: 'need input',
      fields: { name: { type: 'string' } },
    });

    expect(result).toEqual({
      action: 'accept',
      content: { name: 'my-project' },
    });
  });

  it('returns the decline result', async () => {
    vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({
      elicitation: { form: {} },
    });
    vi.mocked(mockMcpServer.server.elicitInput).mockResolvedValue({
      action: 'decline',
    });

    const result = await requestElicitation(mockMcpServer, {
      message: 'need input',
      fields: { name: { type: 'string' } },
    });

    expect(result).toEqual({ action: 'decline' });
  });

  it('returns the cancel result', async () => {
    vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({
      elicitation: { form: {} },
    });
    vi.mocked(mockMcpServer.server.elicitInput).mockResolvedValue({
      action: 'cancel',
    });

    const result = await requestElicitation(mockMcpServer, {
      message: 'need input',
      fields: { name: { type: 'string' } },
    });

    expect(result).toEqual({ action: 'cancel' });
  });

  it('returns undefined and logs a warning when elicitInput throws', async () => {
    vi.mocked(mockMcpServer.server.getClientCapabilities).mockReturnValue({
      elicitation: { form: {} },
    });
    vi.mocked(mockMcpServer.server.elicitInput).mockRejectedValue(
      new Error('transport closed')
    );

    const result = await requestElicitation(
      mockMcpServer,
      {
        message: 'need input',
        fields: { name: { type: 'string' } },
      },
      mockLogger
    );

    expect(result).toBeUndefined();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'elicitation',
      expect.objectContaining({ error: 'transport closed' })
    );
  });

  it('enumField builds a string enum primitive with labels', () => {
    expect(
      enumField('Color', 'pick one', ['red', 'blue'], ['Red', 'Blue'])
    ).toEqual({
      type: 'string',
      title: 'Color',
      description: 'pick one',
      enum: ['red', 'blue'],
      enumNames: ['Red', 'Blue'],
    });
  });

  it('booleanField builds a boolean primitive with a default', () => {
    expect(booleanField('Enabled', 'turn it on', true)).toEqual({
      type: 'boolean',
      title: 'Enabled',
      description: 'turn it on',
      default: true,
    });
  });
});
