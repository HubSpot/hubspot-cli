import { McpToolResponse } from '../../types.js';
import { Tool } from '../../Tool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../utils/logger.js';
import { z } from 'zod';
import { http } from '@hubspot/local-dev-lib/http';
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
import { elicitSelection } from '../../utils/elicitSelection.js';
import { getApps } from './apps.js';

const inputSchema = {
  absoluteCurrentWorkingDirectory,
  absoluteProjectPath: absoluteProjectPath.optional(),
  account,
  appId: z
    .string()
    .describe(
      'The numeric app ID as a string (e.g., "3003909"). Must contain only digits. If omitted and the account has several apps, you will be asked to choose one.'
    )
    .optional(),
  startDate: z
    .string()
    .describe(
      'Start date for the usage patterns query in YYYY-MM-DD format (e.g., 2025-01-01).'
    )
    .optional(),
  endDate: z
    .string()
    .describe(
      'End date for the usage patterns query in YYYY-MM-DD format (e.g., 2025-12-31).'
    )
    .optional(),
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
  constructor(mcpServer: McpServer, logger: McpLogger) {
    super(mcpServer, logger, toolName);
  }

  async handler({
    appId,
    startDate,
    endDate,
    account,
    absoluteCurrentWorkingDirectory,
    absoluteProjectPath,
  }: GetApiUsagePatternsByAppIdInputSchema): Promise<McpToolResponse> {
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

      let resolvedAppId = appId;
      if (!resolvedAppId) {
        const { applications } = await getApps(accountId);
        const apps = applications ?? [];
        if (apps.length === 0) {
          return formatTextContents(
            'No apps found for this account. Nothing to inspect.'
          );
        }
        const selected = await elicitSelection(this.mcpServer, this.logger, {
          message: 'Select the app to inspect usage patterns for.',
          title: 'HubSpot app',
          options: apps.map(app => ({
            value: String(app.appId),
            label: `${app.appName} (${app.appId})`,
          })),
        });
        if (!selected) {
          return formatTextContents(
            `Several apps are available. Ask the user which to use, then call ${toolName} again with the appId argument set to one of: ${apps
              .map(app => `${app.appName} (appId ${app.appId})`)
              .join(', ')}.`
          );
        }
        resolvedAppId = selected;
      }

      const response = await http.get<GetApiUsagePatternsByAppIdResponse>(
        accountId,
        {
          url: `app/feature/utilization/public/v3/insights/app/${resolvedAppId}/usage-patterns`,
          params: {
            ...(startDate && { startDate }),
            ...(endDate && { endDate }),
          },
        }
      );

      // Format the response for display
      const { data } = response;
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
        title: 'Get API Usage Patterns by App ID',
        description:
          'Retrieves detailed API usage pattern analytics for a specific HubSpot app. Requires an appId (string) to identify the target app. Optionally accepts startDate and endDate parameters in YYYY-MM-DD format to filter results within a specific time range. Returns patternSummaries object containing usage statistics including portalPercentage (percentage of portals using this pattern) and numOfPortals (total count of portals) for different usage patterns. This data helps analyze how the app is being used across different HubSpot portals and can inform optimization decisions.',
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
