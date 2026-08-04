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
  account: z
    .string()
    .describe(
      'The HubSpot account id or name from the HubSpot config file to use for the operation.'
    )
    .optional(),
  json: z
    .boolean()
    .describe(
      'Return raw JSON output instead of formatted table. Useful for programmatic access.'
    )
    .optional(),
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({ ...inputSchema });

export type HsListFunctionsInputSchema = z.infer<typeof inputSchemaZodObject>;

const toolName: string = 'list-cms-serverless-functions';

export class HsListFunctionsTool extends Tool<HsListFunctionsInputSchema> {
  constructor(mcpServer: McpServer, logger: McpLogger) {
    super(mcpServer, logger, toolName);
  }

  async handler(
    {
      account,
      json,
      absoluteCurrentWorkingDirectory,
    }: HsListFunctionsInputSchema,
    extra?: ToolExtra
  ): Promise<TextContentResponse> {
    setupHubSpotConfig(absoluteCurrentWorkingDirectory);

    const command = new HubSpotCommand('cms function list');

    if (json) {
      command.addFlag('json', true);
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
      return {
        content: [
          {
            type: 'text',
            text: `Error executing hs function list command: ${getErrorMessage(error)}`,
          },
        ],
      };
    }
  }

  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'List HubSpot CMS Serverless Functions',
        description:
          'Get a list of all serverless functions deployed in a HubSpot portal/account. Shows function routes, HTTP methods, secrets, and timestamps.',
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
