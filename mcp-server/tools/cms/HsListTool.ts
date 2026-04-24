import { TextContentResponse } from '../../types.js';
import { Tool } from '../../Tool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../utils/logger.js';
import { z } from 'zod';
import { addFlag } from '../../utils/command.js';
import { absoluteCurrentWorkingDirectory } from '../project/constants.js';
import { runCommandInDir } from '../../utils/command.js';
import { formatTextContents } from '../../utils/content.js';
import { setupHubSpotConfig } from '../../utils/config.js';
import { getErrorMessage } from '../../../lib/errorHandlers/index.js';

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
  constructor(mcpServer: McpServer, logger: McpLogger) {
    super(mcpServer, logger, toolName);
  }

  async handler({
    path,
    account,
    absoluteCurrentWorkingDirectory,
  }: HsListInputSchema): Promise<TextContentResponse> {
    setupHubSpotConfig(absoluteCurrentWorkingDirectory);

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
            text: `Error executing hs list command: ${getErrorMessage(error)}`,
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
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
      input => this.wrappedHandler(input)
    );
  }
}
