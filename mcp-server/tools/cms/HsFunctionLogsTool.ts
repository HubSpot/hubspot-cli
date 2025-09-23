import { TextContentResponse, Tool } from '../../types.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { addFlag } from '../../utils/command.js';
import { absoluteCurrentWorkingDirectory } from '../project/constants.js';
import { runCommandInDir } from '../../utils/project.js';
import { formatTextContents } from '../../utils/content.js';
import { trackToolUsage } from '../../utils/toolUsageTracking.js';

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
  constructor(mcpServer: McpServer) {
    super(mcpServer);
  }

  async handler({
    endpoint,
    account,
    latest,
    compact,
    limit,
    absoluteCurrentWorkingDirectory,
  }: HsFunctionLogsInputSchema): Promise<TextContentResponse> {
    await trackToolUsage(toolName);

    // Ensure endpoint doesn't start with '/'
    const normalizedEndpoint = endpoint.startsWith('/')
      ? endpoint.slice(1)
      : endpoint;
    let command = `hs logs ${normalizedEndpoint}`;

    if (latest) {
      command = addFlag(command, 'latest', latest);
    }

    if (compact) {
      command = addFlag(command, 'compact', compact);
    }

    if (limit) {
      command = addFlag(command, 'limit', limit);
    }

    if (account) {
      command = addFlag(command, 'account', account);
    }

    try {
      const { stdout, stderr } = await runCommandInDir(
        absoluteCurrentWorkingDirectory,
        command
      );

      return formatTextContents(stdout, stderr);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Error executing hs logs command: ${errorMessage}`,
          },
        ],
      };
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
      },
      this.handler
    );
  }
}
