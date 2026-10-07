import { http } from '@hubspot/local-dev-lib/http';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../utils/logger.js';
import z from 'zod';
import { McpToolResponse } from '../../types.js';
import { Tool } from '../../Tool.js';
import { formatTextContents } from '../../utils/content.js';
import {
  absoluteCurrentWorkingDirectory,
  account,
  docsSearchQuery,
} from './constants.js';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import { setupHubSpotConfig } from '../../utils/config.js';
import { resolveAccountId } from './resolveAccount.js';
import { getErrorMessage } from '../../../lib/errorHandlers/index.js';

const docsSearchLimit = z
  .number()
  .int()
  .min(1)
  .max(20)
  .default(5)
  .describe('Maximum number of results to return.');

const docsSearchVersion = z
  .string()
  .default('latest')
  .describe(
    'API documentation version to search. Defaults to "latest" for current docs, which is almost always what you want. Only override when the user explicitly asks about a specific or legacy version, using a date-based version like "2026-03" or "legacy". Versionless docs such as guides and CMS pages are always included regardless of this value.'
  );

const inputSchema = {
  absoluteCurrentWorkingDirectory,
  account,
  docsSearchQuery,
  docsSearchLimit,
  docsSearchVersion,
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
    version?: string;
  }[];
}
type InputSchemaType = z.infer<typeof inputSchemaZodObject>;

const toolName: string = 'search-docs';

export class DocsSearchTool extends Tool<InputSchemaType> {
  constructor(mcpServer: McpServer, logger: McpLogger) {
    super(mcpServer, logger, toolName);
  }

  protected getTrackingMeta({
    docsSearchQuery,
  }: InputSchemaType): { [key: string]: string } | undefined {
    return { mode: docsSearchQuery };
  }

  async handler({
    docsSearchQuery,
    docsSearchLimit,
    docsSearchVersion,
    account,
    absoluteCurrentWorkingDirectory,
  }: InputSchemaType): Promise<McpToolResponse> {
    setupHubSpotConfig(absoluteCurrentWorkingDirectory);

    try {
      const resolved = await resolveAccountId(this.mcpServer, this.logger, {
        toolName,
        account,
      });
      if ('response' in resolved) {
        return resolved.response;
      }
      const { accountId } = resolved;

      const response = await http.post<DocsSearchResponse>(accountId, {
        url: 'dev/docs/llms/v1/docs-search',
        data: {
          query: docsSearchQuery,
          version: docsSearchVersion,
        },
      });

      const results = response.data.results;
      if (!results || results.length === 0) {
        return formatTextContents('No documentation found for your query.');
      }

      // The docs-search API returns duplicate URLs; dedupe to avoid wasting the result limit on repeats
      const seen = new Set<string>();
      const dedupedResults = results.filter(result => {
        if (seen.has(result.url)) {
          return false;
        }
        seen.add(result.url);
        return true;
      });

      const limitedResults = dedupedResults.slice(0, docsSearchLimit);

      const formattedResults = limitedResults
        .map(
          result =>
            `**${result.title}**\n${result.description}\nURL: ${result.url}\nScore: ${result.score}\n\n${result.content}\n---\n`
        )
        .join('\n');

      const successMessage = `Found ${dedupedResults.length} results, showing top ${limitedResults.length}:\n\n${formattedResults}`;
      return formatTextContents(successMessage);
    } catch (error) {
      this.logger.debug(toolName, {
        message: 'Handler caught error',
        error: error instanceof Error ? error.message : String(error),
      });
      if (isHubSpotHttpError(error)) {
        // Handle different status codes
        return formatTextContents(error.toString());
      }

      const errorMessage = `Error searching documentation: ${getErrorMessage(error)}`;
      return formatTextContents(errorMessage);
    }
  }

  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'Search HubSpot Developer Documentation',
        description:
          'Use this first for any HubSpot developer question, including whether an API or feature is available on a subscription tier or plan (for example "is the content audit API available on Content Hub Professional"). The doc you fetch next states the required product and tier; report it in plain terms (for example "requires Content Hub Enterprise") rather than quoting raw spec fields. This searches the official HubSpot Developer Documentation and returns the most relevant pages, each with a URL for use in `fetch-doc`. Always follow this with a fetch to get the full, authoritative content before making plans or writing answers.',
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
