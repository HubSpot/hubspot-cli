import { Tool } from '../Tool.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../utils/logger.js';
import { TextContentResponse } from '../types.js';
import { trackToolUsage } from '../utils/toolUsageTracking.js';
import { mcpFeedbackRequest } from '../utils/feedbackTracking.js';
import { MockedFunction, Mocked } from 'vitest';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../utils/logger.js');
vi.mock('../utils/toolUsageTracking');
vi.mock('../utils/feedbackTracking');

const mockTrackToolUsage = trackToolUsage as MockedFunction<
  typeof trackToolUsage
>;

const mockMcpFeedbackRequest = mcpFeedbackRequest as MockedFunction<
  typeof mcpFeedbackRequest
>;

type TestInput = { value: string };

class TestTool extends Tool<TestInput> {
  constructor(mcpServer: McpServer, logger: McpLogger, toolName = 'test-tool') {
    super(mcpServer, logger, toolName);
  }

  public invokeWrapped(input: TestInput): Promise<TextContentResponse> {
    return this.wrappedHandler(input);
  }
}

class SuccessTool extends TestTool {
  handler(input: TestInput): TextContentResponse {
    return { content: [{ type: 'text', text: `handled:${input.value}` }] };
  }
}

class AsyncSuccessTool extends TestTool {
  async handler(input: TestInput): Promise<TextContentResponse> {
    return { content: [{ type: 'text', text: `async:${input.value}` }] };
  }
}

class ThrowingTool extends TestTool {
  handler(): TextContentResponse {
    throw new Error('Handler exploded');
  }
}

class NonErrorThrowingTool extends TestTool {
  handler(): TextContentResponse {
    throw 'string failure';
  }
}

class MetaTool extends TestTool {
  protected getTrackingMeta(input: TestInput): { [key: string]: string } {
    return { mode: input.value };
  }

  handler(): TextContentResponse {
    return { content: [{ type: 'text', text: 'ok' }] };
  }
}

describe('mcp-server/Tool', () => {
  let mockMcpServer: Mocked<McpServer>;
  let mockLogger: Mocked<McpLogger>;

  beforeEach(() => {
    // @ts-expect-error Not mocking the whole thing
    mockMcpServer = {
      registerTool: vi.fn(),
    };

    // @ts-expect-error Not mocking the whole thing
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockTrackToolUsage.mockResolvedValue(undefined);
    mockMcpFeedbackRequest.mockResolvedValue('');
  });

  describe('base methods', () => {
    it('register should throw when not implemented', () => {
      const tool = new Tool(mockMcpServer, mockLogger, 'test-tool');

      expect(() => tool.register()).toThrow('Must implement register');
    });

    it('handler should throw when not implemented', () => {
      const tool = new Tool(mockMcpServer, mockLogger, 'test-tool');

      expect(() => tool.handler({})).toThrow('Must implement handler');
    });
  });

  describe('wrappedHandler', () => {
    it('should log tool invocation with input and return handler result', async () => {
      const tool = new SuccessTool(mockMcpServer, mockLogger);

      const result = await tool.invokeWrapped({ value: 'hello' });

      expect(mockLogger.debug).toHaveBeenCalledWith('test-tool', {
        message: 'Tool invoked',
        args: { value: 'hello' },
      });
      expect(result).toEqual({
        content: [{ type: 'text', text: 'handled:hello' }],
      });
    });

    it('should call trackToolUsage with toolName and no meta by default', async () => {
      const tool = new SuccessTool(mockMcpServer, mockLogger, 'custom-name');

      await tool.invokeWrapped({ value: 'hello' });

      expect(mockTrackToolUsage).toHaveBeenCalledWith('custom-name', undefined);
    });

    it('should call trackToolUsage with meta from getTrackingMeta override', async () => {
      const tool = new MetaTool(mockMcpServer, mockLogger);

      await tool.invokeWrapped({ value: 'search-term' });

      expect(mockTrackToolUsage).toHaveBeenCalledWith('test-tool', {
        mode: 'search-term',
      });
    });

    it('should await async handlers', async () => {
      const tool = new AsyncSuccessTool(mockMcpServer, mockLogger);

      const result = await tool.invokeWrapped({ value: 'hi' });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'async:hi' }],
      });
    });

    it('should log tool completion with duration after success', async () => {
      const tool = new SuccessTool(mockMcpServer, mockLogger);

      await tool.invokeWrapped({ value: 'hello' });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'test-tool',
        expect.objectContaining({
          message: 'Tool completed',
          durationMs: expect.any(Number),
        })
      );
    });

    it('should not log completion when handler throws', async () => {
      const tool = new ThrowingTool(mockMcpServer, mockLogger);

      await tool.invokeWrapped({ value: 'hello' });

      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        'test-tool',
        expect.objectContaining({ message: 'Tool completed' })
      );
    });

    it('should log tool failure and return formatted error when handler throws Error', async () => {
      const tool = new ThrowingTool(mockMcpServer, mockLogger);

      const result = await tool.invokeWrapped({ value: 'hello' });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'test-tool',
        expect.objectContaining({
          message: 'Tool failed',
          error: 'Handler exploded',
          durationMs: expect.any(Number),
        })
      );
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Handler exploded' }],
      });
    });

    it('should stringify non-Error thrown values', async () => {
      const tool = new NonErrorThrowingTool(mockMcpServer, mockLogger);

      const result = await tool.invokeWrapped({ value: 'hello' });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'test-tool',
        expect.objectContaining({
          message: 'Tool failed',
          error: 'string failure',
        })
      );
      expect(result).toEqual({
        content: [{ type: 'text', text: 'string failure' }],
      });
    });

    it('should still track usage even when handler throws', async () => {
      const tool = new ThrowingTool(mockMcpServer, mockLogger);

      await tool.invokeWrapped({ value: 'hello' });

      expect(mockTrackToolUsage).toHaveBeenCalledWith('test-tool', undefined);
    });

    it('should surface error when trackToolUsage rejects', async () => {
      mockTrackToolUsage.mockRejectedValue(new Error('tracking failed'));
      const tool = new SuccessTool(mockMcpServer, mockLogger);

      const result = await tool.invokeWrapped({ value: 'hello' });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'test-tool',
        expect.objectContaining({
          message: 'Tool failed',
          error: 'tracking failed',
        })
      );
      expect(result).toEqual({
        content: [{ type: 'text', text: 'tracking failed' }],
      });
    });
  });
});
