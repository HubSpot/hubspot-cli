import { McpToolResponse } from '../../types.js';
import { Tool } from '../../Tool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../utils/logger.js';
import { z } from 'zod';
import { formatTextContents } from '../../utils/content.js';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import {
  absoluteCurrentWorkingDirectory,
  absoluteProjectPath,
  account,
} from './constants.js';
import { setupHubSpotConfig } from '../../utils/config.js';
import { resolveAccountId } from './resolveAccount.js';
import { getErrorMessage } from '../../../lib/errorHandlers/index.js';
import { getApps } from './apps.js';

const inputSchema = {
  absoluteCurrentWorkingDirectory,
  absoluteProjectPath: absoluteProjectPath.optional(),
  account,
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({ ...inputSchema });

export type GetApplicationInfoInputSchema = z.infer<
  typeof inputSchemaZodObject
>;

const toolName: string = 'get-apps-info';

export class GetApplicationInfoTool extends Tool<GetApplicationInfoInputSchema> {
  constructor(mcpServer: McpServer, logger: McpLogger) {
    super(mcpServer, logger, toolName);
  }

  async handler({
    account,
    absoluteCurrentWorkingDirectory,
    absoluteProjectPath,
  }: GetApplicationInfoInputSchema): Promise<McpToolResponse> {
    setupHubSpotConfig(absoluteProjectPath ?? absoluteCurrentWorkingDirectory);

    try {
      const resolved = await resolveAccountId(this.mcpServer, this.logger, {
        toolName,
        account,
      });
      if ('response' in resolved) {
        return resolved.response;
      }
      const { accountId } = resolved;

      const data = await getApps(accountId);
      const formattedResult = JSON.stringify(data, null, 2);
      return formatTextContents(formattedResult);
    } catch (error) {
      this.logger.debug(toolName, {
        message: 'Handler caught error',
        error: error instanceof Error ? error.message : String(error),
      });
      if (isHubSpotHttpError(error)) {
        // Handle HubSpot-specific HTTP errors
        return formatTextContents(error.toString());
      }

      return formatTextContents(getErrorMessage(error));
    }
  }

  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'Get Apps Information',
        description:
          'Retrieves a list of all HubSpot apps available in the current account. Returns an array of apps, where each app contains an appId (numeric identifier) and appName (string). This information is useful for identifying available apps before using other tools that require specific app IDs, such as getting API usage patterns. No input parameters are required - this tool fetches all apps from the HubSpot Insights API.',
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
