import { TextContentResponse } from '../../types.js';
import { Tool, ToolExtra } from '../../Tool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../utils/logger.js';
import { z } from 'zod';
import { HubSpotCommand } from '../../utils/command.js';
import { absoluteCurrentWorkingDirectory } from '../project/constants.js';
import { formatTextContents } from '../../utils/content.js';
import { setupHubSpotConfig } from '../../utils/config.js';
import { getErrorMessage } from '../../../lib/errorHandlers/index.js';

const inputSchema = {
  absoluteCurrentWorkingDirectory,
  endpoint: z
    .string()
    .describe(
      'The function endpoint/path to get logs for. Required. Example: "my-function" or "api/my-endpoint" (leading slash will be automatically removed)'
    ),
  account: z
    .string()
    .describe(
      'The HubSpot account id or name from the HubSpot config file to use for the operation.'
    )
    .optional(),
  latest: z
    .boolean()
    .describe('Get only the latest log entry for the function.')
    .optional(),
  compact: z.boolean().describe('Display logs in compact format.').optional(),
  limit: z
    .number()
    .describe('Maximum number of log entries to retrieve.')
    .optional(),
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({ ...inputSchema });

export type HsFunctionLogsInputSchema = z.infer<typeof inputSchemaZodObject>;

const toolName: string = 'get-cms-serverless-function-logs';

export class HsFunctionLogsTool extends Tool<HsFunctionLogsInputSchema> {
  constructor(mcpServer: McpServer, logger: McpLogger) {
    super(mcpServer, logger, toolName);
  }

  async handler(
    {
      endpoint,
      account,
      latest,
      compact,
      limit,
      absoluteCurrentWorkingDirectory,
    }: HsFunctionLogsInputSchema,
    extra?: ToolExtra
  ): Promise<TextContentResponse> {
    setupHubSpotConfig(absoluteCurrentWorkingDirectory);

    // Ensure endpoint doesn't start with '/'
    const normalizedEndpoint = endpoint.startsWith('/')
      ? endpoint.slice(1)
      : endpoint;
    const command = new HubSpotCommand(
      `cms function logs ${normalizedEndpoint}`
    );

    if (latest) {
      command.addFlag('latest', latest);
    }

    if (compact) {
      command.addFlag('compact', compact);
    }

    if (limit) {
      command.addFlag('limit', limit);
    }

    if (account) {
      command.addFlag('account', account);
    }

    try {
      const { stdout, stderr } = await this.runCommand(
        absoluteCurrentWorkingDirectory,
        command,
        extra
      );

      return formatTextContents(stdout, stderr);
    } catch (error) {
      this.logger.debug(toolName, {
        message: 'Handler caught error',
        error: error instanceof Error ? error.message : String(error),
      });
      return formatTextContents(
        `Error executing hs logs command: ${getErrorMessage(error)}`
      );
    }
  }

  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'Get HubSpot CMS serverless function logs for an endpoint',
        description:
          'Retrieve logs for HubSpot CMS serverless functions. Use this tool to help debug issues with serverless functions by reading the production logs. Supports various options like latest, compact, and limiting results. Use after listing functions with list-cms-serverless-functions to get the endpoint path.',
        inputSchema,
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
      (input, extra) => this.wrappedHandler(input, extra)
    );
  }
}
