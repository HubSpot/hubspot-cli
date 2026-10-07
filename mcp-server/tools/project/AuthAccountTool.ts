import { z } from 'zod';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../utils/logger.js';
import { Tool, ToolExtra } from '../../Tool.js';
import { McpToolResponse } from '../../types.js';
import { formatTextContents } from '../../utils/content.js';
import { HubSpotCommand } from '../../utils/command.js';
import { setupHubSpotConfig } from '../../utils/config.js';
import { parseCommandJsonOutput } from '../../utils/json.js';
import { booleanField } from '../../utils/elicitation.js';
import { absoluteCurrentWorkingDirectory } from './constants.js';
import { getErrorMessage } from '../../../lib/errorHandlers/index.js';
import { getCurrentDefaultAccount } from '../../../lib/accountAuth.js';
import { AccountAuthSchema } from '../../../lib/jsonOutput/accountAuth.js';

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
      'Optional: set this account as the default for CLI operations. Omit unless the user stated a preference. If omitted and another account is already the default, the user is asked whether to replace it.'
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
  ): Promise<McpToolResponse> {
    setupHubSpotConfig(absoluteCurrentWorkingDirectory);

    const command = new HubSpotCommand('account auth', [
      { name: 'json', value: true },
    ]);

    if (name) {
      command.addFlag('name', name);
    } else {
      command.addFlag('use-default-name', 'true');
    }

    if (accountId !== undefined) {
      command.addFlag('account', accountId);
    }

    const resolvedSetAsDefault =
      setAsDefault ?? (await this.resolveSetAsDefault(accountId));

    command.addFlag('default', resolvedSetAsDefault ? 'true' : 'false');

    try {
      const { stdout, stderr } = await this.runCommand(
        absoluteCurrentWorkingDirectory,
        command,
        extra
      );

      const structuredContent = parseCommandJsonOutput(
        stdout,
        AccountAuthSchema,
        this.logger,
        toolName
      );

      const response = await formatTextContents(stdout, stderr);
      if (structuredContent) {
        response.structuredContent = structuredContent;
      }

      return response;
    } catch (error) {
      this.logger.debug(toolName, {
        message: 'Handler caught error running hs account auth',
        error: error instanceof Error ? error.message : String(error),
      });
      return formatTextContents(getErrorMessage(error));
    }
  }

  private async resolveSetAsDefault(accountId?: number): Promise<boolean> {
    const currentDefault = getCurrentDefaultAccount();

    if (!currentDefault || currentDefault.accountId === accountId) {
      return true;
    }

    const elicitation = await this.elicit({
      message: `${currentDefault.name} is the default HubSpot account. Set the account you authenticate now as the new default?`,
      fields: {
        setAsDefault: booleanField(
          'Set as default account',
          `Other CLI commands will use the new account instead of ${currentDefault.name}.`,
          true
        ),
      },
      required: ['setAsDefault'],
    });

    if (!elicitation) {
      return true;
    }

    return (
      elicitation.action === 'accept' &&
      elicitation.content?.setAsDefault === true
    );
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
          'If another account is already the default and setAsDefault is omitted, the tool asks the user whether to replace it. If the client cannot ask the user, the new account becomes the default.',
        inputSchema,
        outputSchema: AccountAuthSchema.shape,
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
