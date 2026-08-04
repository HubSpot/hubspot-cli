import { z } from 'zod';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../utils/logger.js';
import { Tool, ToolExtra } from '../../Tool.js';
import { TextContentResponse } from '../../types.js';
import { formatTextContents } from '../../utils/content.js';
import { HubSpotCommand } from '../../utils/command.js';
import { setupHubSpotConfig } from '../../utils/config.js';
import { absoluteCurrentWorkingDirectory } from './constants.js';
import { getErrorMessage } from '../../../lib/errorHandlers/index.js';

const inputSchema = {
  absoluteCurrentWorkingDirectory,
  accountId: z
    .number()
    .optional()
    .describe('The HubSpot portal ID to authenticate.'),
  name: z
    .string()
    .optional()
    .describe(
      'A name to assign to this account in the HubSpot CLI config. Defaults to the portal name if not provided.'
    ),
  setAsDefault: z
    .boolean()
    .optional()
    .describe(
      'Set this account as the default for CLI operations. Defaults to true when not specified.'
    ),
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({ ...inputSchema });

export type AuthAccountInputSchema = z.infer<typeof inputSchemaZodObject>;

const toolName = 'auth-account';

export class AuthAccountTool extends Tool<AuthAccountInputSchema> {
  constructor(mcpServer: McpServer, logger: McpLogger) {
    super(mcpServer, logger, toolName);
  }

  async handler(
    {
      absoluteCurrentWorkingDirectory,
      accountId,
      name,
      setAsDefault,
    }: AuthAccountInputSchema,
    extra?: ToolExtra
  ): Promise<TextContentResponse> {
    setupHubSpotConfig(absoluteCurrentWorkingDirectory);

    const command = new HubSpotCommand('account auth');

    if (name) {
      command.addFlag('name', name);
    } else {
      command.addFlag('use-default-name', 'true');
    }

    if (accountId !== undefined) {
      command.addFlag('account', accountId);
    }

    command.addFlag('default', setAsDefault === false ? 'false' : 'true');

    try {
      const { stdout, stderr } = await this.runCommand(
        absoluteCurrentWorkingDirectory,
        command,
        extra
      );
      return formatTextContents(stdout, stderr);
    } catch (error) {
      this.logger.debug(toolName, {
        message: 'Handler caught error running hs account auth',
        error: error instanceof Error ? error.message : String(error),
      });
      return formatTextContents(getErrorMessage(error));
    }
  }

  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'Authenticate a HubSpot Account',
        description:
          'Authenticates a HubSpot account with the CLI using `hs account auth`.\n\n' +
          'WHEN TO USE:\n' +
          '- The user wants to add or authenticate a HubSpot account\n' +
          '- Any other tool reports that no account is configured\n' +
          '- The user asks how to connect their HubSpot account to the CLI\n\n' +
          'WORKFLOW:\n' +
          '1. Call this tool — it opens a browser tab for the user to authorize\n' +
          '2. The user clicks "Connect to CLI" in the browser\n' +
          '3. Auth completes automatically via WebSocket\n' +
          '4. Retry any operation that was blocked by missing auth\n\n' +
          'setAsDefault defaults to true. Pass setAsDefault: false to keep an existing default account.',
        inputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      (input, extra) => this.wrappedHandler(input, extra)
    );
  }
}
