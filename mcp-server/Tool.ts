import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import {
  ServerNotification,
  ServerRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { McpLogger } from './utils/logger.js';
import { TextContentResponse } from './types.js';
import { formatTextContents } from './utils/content.js';
import { getErrorMessage } from '../lib/errorHandlers/index.js';
import { trackToolUsage } from './utils/toolUsageTracking.js';
import { CommandResults, Command, runCommandInDir } from './utils/command.js';

export type ToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

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
    _input: InputSchema
  ): TextContentResponse | Promise<TextContentResponse> {
    throw new Error('Must implement handler');
  }

  protected runCommand(
    directory: string,
    command: Command,
    extra?: ToolExtra
  ): Promise<CommandResults> {
    let progressCount = 0;

    return runCommandInDir(directory, command, async chunk => {
      try {
        const message = `${chunk.trimEnd()}`;

        this.logger.debug(this.toolName, message);

        const token = extra?._meta?.progressToken;

        if (token !== undefined && extra?.sendNotification) {
          progressCount++;

          await extra.sendNotification({
            method: 'notifications/progress',
            params: {
              progressToken: token,
              progress: progressCount,
              message,
            },
          });
        }
      } catch {
        // Swallow notification errors so a failed notification never crashes the tool
      }
    });
  }

  protected getTrackingMeta(
    _input: InputSchema
  ): { [key: string]: string } | undefined {
    return undefined;
  }

  protected wrappedHandler(
    input: InputSchema,
    extra?: ToolExtra
  ): Promise<TextContentResponse> {
    return this.logger.runWithBuffer(async () => {
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

        const result = await (
          this.handler as (
            input: InputSchema,
            extra?: ToolExtra
          ) => Promise<TextContentResponse>
        )(input, extra);

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
      } finally {
        this.logger.flushLogsToFile(this.toolName);
      }
    });
  }
}
