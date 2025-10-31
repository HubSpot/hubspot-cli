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
  path: z
    .string()
    .describe(
      'The remote directory path in the HubSpot CMS to list contents. If not specified, lists the root directory.'
    )
    .optional(),
  account: z
    .string()
    .describe(
      'The HubSpot account id or name from the HubSpot config file to use for the operation.'
    )
    .optional(),
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({ ...inputSchema });

export type HsListInputSchema = z.infer<typeof inputSchemaZodObject>;

const toolName: string = 'list-cms-remote-contents';

export class HsListTool extends Tool<HsListInputSchema> {
  constructor(mcpServer: McpServer) {
    super(mcpServer);
  }

  async handler({
    path,
    account,
    absoluteCurrentWorkingDirectory,
  }: HsListInputSchema): Promise<TextContentResponse> {
    await trackToolUsage(toolName);

    let command = 'hs list';

    if (path) {
      command += ` ${path}`;
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
            text: `Error executing hs list command: ${errorMessage}`,
          },
        ],
      };
    }
  }

  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'List HubSpot CMS Directory Contents',
        description: 'List remote contents of a HubSpot CMS directory.',
        inputSchema,
      },
      this.handler
    );
  }
}
