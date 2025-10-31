import { TextContentResponse, Tool } from '../../types.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { trackToolUsage } from '../../utils/toolUsageTracking.js';
import { http } from '@hubspot/local-dev-lib/http';
import { formatTextContents } from '../../utils/content.js';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import { getAccountId } from '@hubspot/local-dev-lib/config';
import { absoluteCurrentWorkingDirectory } from './constants.js';

const inputSchema = { absoluteCurrentWorkingDirectory };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({ ...inputSchema });

export type GetApplicationInfoInputSchema = z.infer<
  typeof inputSchemaZodObject
>;

const toolName: string = 'get-applications-info';

interface ApplicationInfo {
  appId: number;
  appName: string;
}

interface GetApplicationInfoResponse {
  applications: ApplicationInfo[];
}

export class GetApplicationInfoTool extends Tool<GetApplicationInfoInputSchema> {
  constructor(mcpServer: McpServer) {
    super(mcpServer);
  }

  async handler({
    absoluteCurrentWorkingDirectory,
  }: GetApplicationInfoInputSchema): Promise<TextContentResponse> {
    await trackToolUsage(toolName);

    try {
      // Get account ID from CLI config
      const accountId = getAccountId();

      if (!accountId) {
        const authErrorMessage = `No account ID found. Please run \`hs account auth\` to configure an account, or set a default account with \`hs account use <account>\``;
        return formatTextContents(
          absoluteCurrentWorkingDirectory,
          authErrorMessage
        );
      }

      const response = await http.get<GetApplicationInfoResponse>(accountId, {
        url: `app/feature/utilization/public/v3/insights/apps`,
      });

      // Format the response for display
      const { data } = response;
      const formattedResult = JSON.stringify(data, null, 2);
      return formatTextContents(
        absoluteCurrentWorkingDirectory,
        formattedResult
      );
    } catch (error) {
      if (isHubSpotHttpError(error)) {
        // Handle HubSpot-specific HTTP errors
        return formatTextContents(
          absoluteCurrentWorkingDirectory,
          error.toString()
        );
      }

      const errorMessage = `${error instanceof Error ? error.message : String(error)}`;
      return formatTextContents(absoluteCurrentWorkingDirectory, errorMessage);
    }
  }

  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'Get Applications Information',
        description:
          'Retrieves a list of all HubSpot applications available in the current account. Returns an array of applications, where each application contains an appId (numeric identifier) and appName (string). This information is useful for identifying available applications before using other tools that require specific application IDs, such as getting API usage patterns. No input parameters are required - this tool fetches all applications from the HubSpot Insights API.',
        inputSchema,
      },
      this.handler
    );
  }
}
