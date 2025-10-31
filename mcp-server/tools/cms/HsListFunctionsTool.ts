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
  constructor(mcpServer: McpServer) {
    super(mcpServer);
  }

  async handler({
    account,
    json,
    absoluteCurrentWorkingDirectory,
  }: HsListFunctionsInputSchema): Promise<TextContentResponse> {
    await trackToolUsage(toolName);

    let command = 'hs function list';

    if (json) {
      command += ' --json';
    }

    if (account) {
      command = addFlag(command, 'account', account);
    }

    try {
      const { stdout, stderr } = await runCommandInDir(
        absoluteCurrentWorkingDirectory,
        command
      );

      return formatTextContents(
        absoluteCurrentWorkingDirectory,
        stdout,
        stderr
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Error executing hs function list command: ${errorMessage}`,
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
      },
      this.handler
    );
  }
}
