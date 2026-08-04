import { Tool, ToolExtra } from '../Tool.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../utils/logger.js';
import { TextContentResponse } from '../types.js';
import { trackToolUsage } from '../utils/toolUsageTracking.js';
import { mcpFeedbackRequest } from '../utils/feedbackTracking.js';
import { runCommandInDir, HubSpotCommand } from '../utils/command.js';
import { MockedFunction, Mocked } from 'vitest';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('../utils/logger.js');
vi.mock('../utils/toolUsageTracking');
vi.mock('../utils/feedbackTracking');
vi.mock('../utils/command', async importOriginal => {
  const mod = await importOriginal<typeof import('../utils/command.js')>();
  return { ...mod, runCommandInDir: vi.fn() };
});

const mockTrackToolUsage = trackToolUsage as MockedFunction<
  typeof trackToolUsage
>;

const mockMcpFeedbackRequest = mcpFeedbackRequest as MockedFunction<
  typeof mcpFeedbackRequest
>;

const mockRunCommandInDir = runCommandInDir as MockedFunction<
  typeof runCommandInDir
>;

type TestInput = { value: string };

class TestTool extends Tool<TestInput> {
  constructor(mcpServer: McpServer, logger: McpLogger, toolName = 'test-tool') {
    super(mcpServer, logger, toolName);
  }

  public invokeWrapped(
    input: TestInput,
    extra?: ToolExtra
  ): Promise<TextContentResponse> {
    return this.wrappedHandler(input, extra);
  }

  public invokeRunCommand(
    directory: string,
    command: HubSpotCommand,
    extra?: ToolExtra
  ) {
    return this.runCommand(directory, command, extra);
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

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      flushLogsToFile: vi.fn(),
      runWithBuffer: vi.fn(<T>(fn: () => Promise<T>) => fn()),
    } as unknown as Mocked<McpLogger>;

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

    it('should flush logs to file after successful tool execution', async () => {
      const tool = new SuccessTool(mockMcpServer, mockLogger);

      await tool.invokeWrapped({ value: 'hello' });

      expect(mockLogger.flushLogsToFile).toHaveBeenCalledWith('test-tool');
    });

    it('should flush logs to file after failed tool execution', async () => {
      const tool = new ThrowingTool(mockMcpServer, mockLogger);

      await tool.invokeWrapped({ value: 'hello' });

      expect(mockLogger.flushLogsToFile).toHaveBeenCalledWith('test-tool');
    });
  });

  describe('runCommand', () => {
    beforeEach(() => {
      mockRunCommandInDir.mockResolvedValue({ stdout: '', stderr: '' });
    });

    it('should send a progress notification for every chunk when progressToken is present', async () => {
      const sendNotification = vi.fn().mockResolvedValue(undefined);
      const extra = {
        _meta: { progressToken: 'tok-1' },
        sendNotification,
      } as unknown as ToolExtra;

      let capturedOnData:
        ((chunk: string, source: 'stdout' | 'stderr') => void) | undefined;
      mockRunCommandInDir.mockImplementation((_dir, _cmd, onData) => {
        capturedOnData = onData;
        return Promise.resolve({ stdout: 'out', stderr: '' });
      });

      const tool = new TestTool(mockMcpServer, mockLogger);
      const promise = tool.invokeRunCommand(
        '/dir',
        new HubSpotCommand('build'),
        extra
      );

      capturedOnData?.('line one\n', 'stdout');
      capturedOnData?.('line two\n', 'stdout');
      capturedOnData?.('line three\n', 'stdout');

      await promise;

      expect(sendNotification).toHaveBeenCalledTimes(3);
      expect(sendNotification).toHaveBeenNthCalledWith(1, {
        method: 'notifications/progress',
        params: { progressToken: 'tok-1', progress: 1, message: 'line one' },
      });
      expect(sendNotification).toHaveBeenNthCalledWith(3, {
        method: 'notifications/progress',
        params: { progressToken: 'tok-1', progress: 3, message: 'line three' },
      });
    });

    it('should silently ignore chunks when no progressToken is present', async () => {
      let capturedOnData:
        ((chunk: string, source: 'stdout' | 'stderr') => void) | undefined;
      mockRunCommandInDir.mockImplementation((_dir, _cmd, onData) => {
        capturedOnData = onData;
        return Promise.resolve({ stdout: 'out', stderr: '' });
      });

      const tool = new TestTool(mockMcpServer, mockLogger);
      const promise = tool.invokeRunCommand(
        '/dir',
        new HubSpotCommand('build')
      );

      capturedOnData?.('some output\n', 'stdout');

      await promise;

      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('should log each chunk to the buffer regardless of progress token', async () => {
      let capturedOnData:
        ((chunk: string, source: 'stdout' | 'stderr') => void) | undefined;
      mockRunCommandInDir.mockImplementation((_dir, _cmd, onData) => {
        capturedOnData = onData;
        return Promise.resolve({ stdout: 'out', stderr: '' });
      });

      const tool = new TestTool(mockMcpServer, mockLogger);
      const promise = tool.invokeRunCommand(
        '/dir',
        new HubSpotCommand('build')
      );

      capturedOnData?.('line one\n', 'stdout');
      capturedOnData?.('line two\n', 'stdout');

      await promise;

      expect(mockLogger.debug).toHaveBeenCalledWith('test-tool', 'line one');
      expect(mockLogger.debug).toHaveBeenCalledWith('test-tool', 'line two');
    });

    it('should swallow errors thrown by sendNotification', async () => {
      const sendNotification = vi
        .fn()
        .mockRejectedValue(new Error('transport closed'));
      const extra = {
        _meta: { progressToken: 'tok-2' },
        sendNotification,
      } as unknown as ToolExtra;

      let capturedOnData:
        ((chunk: string, source: 'stdout' | 'stderr') => void) | undefined;
      mockRunCommandInDir.mockImplementation((_dir, _cmd, onData) => {
        capturedOnData = onData;
        return Promise.resolve({ stdout: 'out', stderr: '' });
      });

      const tool = new TestTool(mockMcpServer, mockLogger);
      const promise = tool.invokeRunCommand(
        '/dir',
        new HubSpotCommand('build'),
        extra
      );

      capturedOnData?.('output\n', 'stdout');

      await expect(promise).resolves.toEqual({ stdout: 'out', stderr: '' });
    });
  });

  describe('runCommand', () => {
    beforeEach(() => {
      mockRunCommandInDir.mockResolvedValue({ stdout: '', stderr: '' });
    });

    it('should send a progress notification for every chunk when progressToken is present', async () => {
      const sendNotification = vi.fn().mockResolvedValue(undefined);
      const extra = {
        _meta: { progressToken: 'tok-1' },
        sendNotification,
      } as unknown as ToolExtra;

      let capturedOnData:
        ((chunk: string, source: 'stdout' | 'stderr') => void) | undefined;
      mockRunCommandInDir.mockImplementation((_dir, _cmd, onData) => {
        capturedOnData = onData;
        return Promise.resolve({ stdout: 'out', stderr: '' });
      });

      const tool = new TestTool(mockMcpServer, mockLogger);
      const promise = tool.invokeRunCommand(
        '/dir',
        new HubSpotCommand('build'),
        extra
      );

      capturedOnData?.('line one\n', 'stdout');
      capturedOnData?.('line two\n', 'stdout');
      capturedOnData?.('line three\n', 'stdout');

      await promise;

      expect(sendNotification).toHaveBeenCalledTimes(3);
      expect(sendNotification).toHaveBeenNthCalledWith(1, {
        method: 'notifications/progress',
        params: { progressToken: 'tok-1', progress: 1, message: 'line one' },
      });
      expect(sendNotification).toHaveBeenNthCalledWith(3, {
        method: 'notifications/progress',
        params: { progressToken: 'tok-1', progress: 3, message: 'line three' },
      });
    });

    it('should silently ignore chunks when no progressToken is present', async () => {
      let capturedOnData:
        ((chunk: string, source: 'stdout' | 'stderr') => void) | undefined;
      mockRunCommandInDir.mockImplementation((_dir, _cmd, onData) => {
        capturedOnData = onData;
        return Promise.resolve({ stdout: 'out', stderr: '' });
      });

      const tool = new TestTool(mockMcpServer, mockLogger);
      const promise = tool.invokeRunCommand(
        '/dir',
        new HubSpotCommand('build')
      );

      capturedOnData?.('some output\n', 'stdout');

      await promise;

      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('should swallow errors thrown by sendNotification', async () => {
      const sendNotification = vi
        .fn()
        .mockRejectedValue(new Error('transport closed'));
      const extra = {
        _meta: { progressToken: 'tok-2' },
        sendNotification,
      } as unknown as ToolExtra;

      let capturedOnData:
        ((chunk: string, source: 'stdout' | 'stderr') => void) | undefined;
      mockRunCommandInDir.mockImplementation((_dir, _cmd, onData) => {
        capturedOnData = onData;
        return Promise.resolve({ stdout: 'out', stderr: '' });
      });

      const tool = new TestTool(mockMcpServer, mockLogger);
      const promise = tool.invokeRunCommand(
        '/dir',
        new HubSpotCommand('build'),
        extra
      );

      capturedOnData?.('output\n', 'stdout');

      await expect(promise).resolves.toEqual({ stdout: 'out', stderr: '' });
    });
  });
});
