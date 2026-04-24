import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from './utils/logger.js';
import { TextContentResponse } from './types.js';
import { formatTextContents } from './utils/content.js';
import { getErrorMessage } from '../lib/errorHandlers/index.js';
import { trackToolUsage } from './utils/toolUsageTracking.js';

export class Tool<InputSchema> {
  protected mcpServer: McpServer;
  protected logger: McpLogger;
  protected toolName: string;

  constructor(mcpServer: McpServer, logger: McpLogger, toolName: string) {
    this.mcpServer = mcpServer;
    this.logger = logger;
    this.toolName = toolName;
  }
  register(): RegisteredTool {
    throw new Error('Must implement register');
  }

  handler(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    input: InputSchema
  ): TextContentResponse | Promise<TextContentResponse> {
    throw new Error('Must implement handler');
  }

  protected getTrackingMeta(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    input: InputSchema
  ): { [key: string]: string } | undefined {
    return undefined;
  }

  protected async wrappedHandler(
    input: InputSchema
  ): Promise<TextContentResponse> {
    const startTime = Date.now();

    try {
      // `input` is logged unredacted. Tool input schemas MUST NOT include
      // credentials or other sensitive values, since MCP clients (Claude
      // Desktop, Inspector, etc.) will display these logs.
      this.logger.debug(this.toolName, {
        message: 'Tool invoked',
        args: input,
      });

      await trackToolUsage(this.toolName, this.getTrackingMeta(input));

      const result = await this.handler(input);

      this.logger.debug(this.toolName, {
        message: 'Tool completed',
        durationMs: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      this.logger.error(this.toolName, {
        message: 'Tool failed',
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      });

      return formatTextContents(getErrorMessage(error));
    }
  }
}
