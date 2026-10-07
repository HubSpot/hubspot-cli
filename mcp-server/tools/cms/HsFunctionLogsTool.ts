import { McpToolResponse } from '../../types.js';
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
import { getRoutes } from '@hubspot/local-dev-lib/api/functions';
import { discoverAccountTargets } from '../../../lib/accountTargetDiscovery.js';
import { elicitSelection } from '../../utils/elicitSelection.js';

const inputSchema = {
  absoluteCurrentWorkingDirectory,
  endpoint: z
    .string()
    .describe(
      'The function endpoint/path to get logs for. Example: "my-function" or "api/my-endpoint" (leading slash will be automatically removed). If omitted and the account has several functions, you will be asked to choose one.'
    )
    .optional(),
  account: z
    .string()
    .describe(
      'The HubSpot account id or name from the HubSpot config file to use for the operation.'
    )
    .optional(),
  latest: z
    .boolean()
    .describe('Get only the latest log entry for the function.')
    .optional(),
  compact: z.boolean().describe('Display logs in compact format.').optional(),
  limit: z
    .number()
    .describe('Maximum number of log entries to retrieve.')
    .optional(),
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({ ...inputSchema });

export type HsFunctionLogsInputSchema = z.infer<typeof inputSchemaZodObject>;

const toolName: string = 'get-cms-serverless-function-logs';

export class HsFunctionLogsTool extends Tool<HsFunctionLogsInputSchema> {
  constructor(mcpServer: McpServer, logger: McpLogger) {
    super(mcpServer, logger, toolName);
  }

  async handler(
    {
      endpoint,
      account,
      latest,
      compact,
      limit,
      absoluteCurrentWorkingDirectory,
    }: HsFunctionLogsInputSchema,
    extra?: ToolExtra
  ): Promise<McpToolResponse> {
    setupHubSpotConfig(absoluteCurrentWorkingDirectory);

    let resolvedEndpoint = endpoint;
    if (!resolvedEndpoint) {
      const { recommended } = await discoverAccountTargets({
        explicitAccount: account,
      });
      const accountId = recommended?.accountId;
      if (!accountId) {
        return formatTextContents(
          'No account ID found. Call the auth-account tool to authenticate a HubSpot account.'
        );
      }
      try {
        const routesResponse = await getRoutes(accountId);
        const routes = routesResponse.data.objects ?? [];
        if (routes.length === 0) {
          return formatTextContents(
            'No CMS serverless functions found for this account.'
          );
        }
        // The logs command takes a path (method-agnostic), and a path can
        // appear under multiple methods, so dedupe by route to keep the
        // elicitation values unique.
        const seenRoutes = new Set<string>();
        const options: { value: string; label: string }[] = [];
        routes.forEach(route => {
          if (seenRoutes.has(route.route)) {
            return;
          }
          seenRoutes.add(route.route);
          options.push({
            value: route.route,
            label: `${route.method} ${route.route}`,
          });
        });
        const selected = await elicitSelection(this.mcpServer, this.logger, {
          message: 'Select the CMS serverless function to get logs for.',
          title: 'CMS serverless function',
          options,
        });
        if (!selected) {
          return formatTextContents(
            `Several functions are available. Ask the user which to use, then call ${toolName} again with the endpoint argument set to one of: ${options
              .map(option => option.label)
              .join(', ')}.`
          );
        }
        resolvedEndpoint = selected;
      } catch (error) {
        this.logger.debug(toolName, {
          message: 'Failed to list functions for elicitation',
          error: getErrorMessage(error),
        });
        return formatTextContents(
          `Error listing CMS serverless functions: ${getErrorMessage(error)}`
        );
      }
    }

    // Ensure endpoint doesn't start with '/'
    const normalizedEndpoint = resolvedEndpoint.startsWith('/')
      ? resolvedEndpoint.slice(1)
      : resolvedEndpoint;
    const command = new HubSpotCommand(
      `cms function logs ${normalizedEndpoint}`
    );

    if (latest) {
      command.addFlag('latest', latest);
    }

    if (compact) {
      command.addFlag('compact', compact);
    }

    if (limit) {
      command.addFlag('limit', limit);
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
      return formatTextContents(
        `Error executing hs logs command: ${getErrorMessage(error)}`
      );
    }
  }

  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'Get HubSpot CMS serverless function logs for an endpoint',
        description:
          'Retrieve logs for HubSpot CMS serverless functions. These are CMS/website functions, not developer-platform app functions (the private app-function feature or the public app-function-endpoint feature). Use this tool to help debug issues with serverless functions by reading the production logs. Supports various options like latest, compact, and limiting results. Use after listing functions with list-cms-serverless-functions to get the endpoint path.',
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
