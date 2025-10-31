import { GetConfigValuesTool } from '../GetConfigValuesTool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getIntermediateRepresentationSchema,
  mapToInternalType,
} from '@hubspot/project-parsing-lib';
import { getAccountIdFromCliConfig } from '../../../utils/cliConfig.js';
import { MockedFunction, Mocked } from 'vitest';
import { mcpFeedbackRequest } from '../../../utils/feedbackTracking.js';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('@hubspot/project-parsing-lib');
vi.mock('../../../utils/cliConfig.js');
vi.mock('../../../utils/toolUsageTracking');
vi.mock('../../../utils/feedbackTracking');

const mockMcpFeedbackRequest = mcpFeedbackRequest as MockedFunction<
  typeof mcpFeedbackRequest
>;

const mockGetIntermediateRepresentationSchema =
  getIntermediateRepresentationSchema as MockedFunction<
    typeof getIntermediateRepresentationSchema
  >;
const mockMapToInternalType = mapToInternalType as MockedFunction<
  typeof mapToInternalType
>;
const mockGetAccountIdFromCliConfig =
  getAccountIdFromCliConfig as MockedFunction<typeof getAccountIdFromCliConfig>;

describe('mcp-server/tools/project/GetConfigValuesTool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let tool: GetConfigValuesTool;
  let mockRegisteredTool: RegisteredTool;

  beforeEach(() => {
    vi.clearAllMocks();

    // @ts-expect-error Not mocking the whole thing
    mockMcpServer = {
      registerTool: vi.fn(),
    };

    mockRegisteredTool = {} as RegisteredTool;
    mockMcpServer.registerTool.mockReturnValue(mockRegisteredTool);

    mockMcpFeedbackRequest.mockResolvedValue('');

    tool = new GetConfigValuesTool(mockMcpServer);
  });

  describe('register', () => {
    it('should register tool with correct parameters', () => {
      const result = tool.register();

      expect(mockMcpServer.registerTool).toHaveBeenCalledWith(
        'get-feature-config-schema',
        expect.objectContaining({
          title: 'Fetch the JSON Schema for component',
          description: expect.stringContaining(
            'Fetches and returns the JSON schema for the provided feature'
          ),
          inputSchema: expect.objectContaining({
            platformVersion: expect.objectContaining({
              describe: expect.any(Function),
            }),
            featureType: expect.objectContaining({
              describe: expect.any(Function),
            }),
          }),
        }),
        expect.any(Function)
      );
      expect(result).toBe(mockRegisteredTool);
    });
  });

  describe('handler', () => {
    const input = {
      platformVersion: '2025.2',
      featureType: 'card',
      absoluteCurrentWorkingDirectory: '/foo',
    };

    beforeEach(() => {
      mockGetAccountIdFromCliConfig.mockReturnValue(123456789);
    });

    it('should return config schema when component type exists', async () => {
      const mockSchema = {
        'internal-card-type': {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
          },
        },
      };

      mockGetIntermediateRepresentationSchema.mockResolvedValue(mockSchema);
      mockMapToInternalType.mockReturnValue('internal-card-type');

      const result = await tool.handler(input);

      expect(mockGetAccountIdFromCliConfig).toHaveBeenCalledWith('/foo');
      expect(mockGetIntermediateRepresentationSchema).toHaveBeenCalledWith({
        platformVersion: '2025.2',
        projectSourceDir: '',
        accountId: 123456789,
      });

      expect(mockMapToInternalType).toHaveBeenCalledWith('card');

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              config: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            }),
          },
        ],
      });
    });

    it('should return error message when component type does not exist in schema', async () => {
      const mockSchema = {
        'other-type': {
          type: 'object',
          properties: {},
        },
      };

      mockGetIntermediateRepresentationSchema.mockResolvedValue(mockSchema);
      mockMapToInternalType.mockReturnValue('internal-card-type');

      const result = await tool.handler(input);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Unable to locate JSON schema for type card',
          },
        ],
      });
    });

    it('should return error message when getIntermediateRepresentationSchema throws', async () => {
      mockGetIntermediateRepresentationSchema.mockRejectedValue(
        new Error('Schema fetch failed')
      );
      mockMapToInternalType.mockReturnValue('internal-card-type');

      const result = await tool.handler(input);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Unable to locate JSON schema for type card',
          },
        ],
      });
    });

    it('should return error message when mapToInternalType throws', async () => {
      const mockSchema = {};
      mockGetIntermediateRepresentationSchema.mockResolvedValue(mockSchema);
      mockMapToInternalType.mockImplementation(() => {
        throw new Error('Mapping failed');
      });

      const result = await tool.handler(input);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Unable to locate JSON schema for type card',
          },
        ],
      });
    });

    it('should handle null account id', async () => {
      mockGetAccountIdFromCliConfig.mockReturnValue(null);

      const result = await tool.handler(input);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'No account ID found. Please run `hs account auth` to configure an account, or set a default account with `hs account use <account>`',
          },
        ],
      });
    });

    it('should handle empty schema object', async () => {
      const mockSchema = {};

      mockGetIntermediateRepresentationSchema.mockResolvedValue(mockSchema);
      mockMapToInternalType.mockReturnValue('internal-card-type');

      const result = await tool.handler(input);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Unable to locate JSON schema for type card',
          },
        ],
      });
    });

    it('should handle complex nested schema structures', async () => {
      const complexSchema = {
        'internal-card-type': {
          type: 'object',
          properties: {
            title: { type: 'string', maxLength: 100 },
            metadata: {
              type: 'object',
              properties: {
                author: { type: 'string' },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              required: ['author'],
            },
          },
          required: ['title'],
        },
      };

      mockGetIntermediateRepresentationSchema.mockResolvedValue(complexSchema);
      mockMapToInternalType.mockReturnValue('internal-card-type');

      const result = await tool.handler(input);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              config: complexSchema['internal-card-type'],
            }),
          },
        ],
      });
    });
  });
});
