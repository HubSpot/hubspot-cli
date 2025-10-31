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

const inputSchema = {
  absoluteCurrentWorkingDirectory,
  appId: z
    .string()
    .regex(/^\d+$/, 'App ID must be a numeric string')
    .describe(
      'The numeric app ID as a string (e.g., "3003909"). Use get-applications-info to find available app IDs.'
    ),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format')
    .optional()
    .describe(
      'Start date for the usage patterns query in ISO 8601 format (e.g., 2025-01-01).'
    ),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format')
    .optional()
    .describe(
      'End date for the usage patterns query in ISO 8601 format (e.g., 2025-12-31).'
    ),
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({ ...inputSchema });

export type GetApiUsagePatternsByAppIdInputSchema = z.infer<
  typeof inputSchemaZodObject
>;

const toolName: string = 'get-api-usage-patterns-by-app-id';

interface PatternSummary {
  portalPercentage: number;
  numOfPortals: number;
}

interface GetApiUsagePatternsByAppIdResponse {
  patternSummaries: Record<string, PatternSummary>;
}

export class GetApiUsagePatternsByAppIdTool extends Tool<GetApiUsagePatternsByAppIdInputSchema> {
  constructor(mcpServer: McpServer) {
    super(mcpServer);
  }

  async handler({
    absoluteCurrentWorkingDirectory,
    appId,
    startDate,
    endDate,
  }: GetApiUsagePatternsByAppIdInputSchema): Promise<TextContentResponse> {
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

      const response = await http.get<GetApiUsagePatternsByAppIdResponse>(
        accountId,
        {
          url: `app/feature/utilization/public/v3/insights/app/${appId}/usage-patterns`,
          params: {
            ...(startDate && { startDate }),
            ...(endDate && { endDate }),
          },
        }
      );

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
        title: 'Get API Usage Patterns by App ID',
        description:
          'Retrieves detailed API usage pattern analytics for a specific HubSpot application. Requires an appId (string) to identify the target application. Optionally accepts startDate and endDate parameters in YYYY-MM-DD format to filter results within a specific time range. Returns patternSummaries object containing usage statistics including portalPercentage (percentage of portals using this pattern) and numOfPortals (total count of portals) for different usage patterns. This data helps analyze how the application is being used across different HubSpot portals and can inform optimization decisions.',
        inputSchema,
      },
      this.handler
    );
  }
}
