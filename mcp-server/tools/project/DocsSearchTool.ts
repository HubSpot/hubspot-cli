import { http } from '@hubspot/local-dev-lib/http';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import z from 'zod';
import { TextContentResponse, Tool } from '../../types.js';
import { formatTextContents } from '../../utils/content.js';
import { trackToolUsage } from '../../utils/toolUsageTracking.js';
import {
  absoluteCurrentWorkingDirectory,
  docsSearchQuery,
} from './constants.js';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import { getAccountIdFromCliConfig } from '../../utils/cliConfig.js';

const inputSchema = {
  absoluteCurrentWorkingDirectory,
  docsSearchQuery,
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({
  ...inputSchema,
});

export interface DocsSearchResponse {
  results: {
    title: string;
    content: string;
    description: string;
    url: string;
    score: number;
  }[];
}
type InputSchemaType = z.infer<typeof inputSchemaZodObject>;

const toolName: string = 'search-docs';

export class DocsSearchTool extends Tool<InputSchemaType> {
  constructor(mcpServer: McpServer) {
    super(mcpServer);
  }

  async handler({
    absoluteCurrentWorkingDirectory,
    docsSearchQuery,
  }: InputSchemaType): Promise<TextContentResponse> {
    await trackToolUsage(toolName, { mode: docsSearchQuery });

    const accountId = getAccountIdFromCliConfig(
      absoluteCurrentWorkingDirectory
    );

    if (!accountId) {
      const authErrorMessage = `No account ID found. Please run \`hs account auth\` to configure an account, or set a default account with \`hs account use <account>\``;
      return formatTextContents(
        absoluteCurrentWorkingDirectory,
        authErrorMessage
      );
    }

    try {
      const response = await http.post<DocsSearchResponse>(accountId, {
        url: 'dev/docs/llms/v1/docs-search',
        data: {
          query: docsSearchQuery,
        },
      });

      const results = response.data.results;
      if (!results || results.length === 0) {
        return formatTextContents(
          absoluteCurrentWorkingDirectory,
          'No documentation found for your query.'
        );
      }

      const formattedResults = results
        .map(
          result =>
            `**${result.title}**\n${result.description}\nURL: ${result.url}\nScore: ${result.score}\n\n${result.content}\n---\n`
        )
        .join('\n');

      const successMessage = `Found ${results.length} documentation results:\n\n${formattedResults}`;
      return formatTextContents(
        absoluteCurrentWorkingDirectory,
        successMessage
      );
    } catch (error) {
      if (isHubSpotHttpError(error)) {
        // Handle different status codes
        return formatTextContents(
          absoluteCurrentWorkingDirectory,
          error.toString()
        );
      }

      const errorMessage = `Error searching documentation: ${error instanceof Error ? error.message : String(error)}`;
      return formatTextContents(absoluteCurrentWorkingDirectory, errorMessage);
    }
  }

  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'Search HubSpot Developer Documentation',
        description:
          'Use this first whenever you need details about HubSpot APIs, SDKs, integrations, or developer platform features. This searches the official HubSpot Developer Documentation and returns the most relevant pages, each with a URL for use in `fetch-doc`. Always follow this with a fetch to get the full, authoritative content before making plans or writing answers.',
        inputSchema,
      },
      this.handler
    );
  }
}
