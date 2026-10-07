import { http } from '@hubspot/local-dev-lib/http/unauthed';
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
  knowledgeSearchQuery,
} from './constants.js';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import { setupHubSpotConfig } from '../../utils/config.js';
import { getErrorMessage } from '../../../lib/errorHandlers/index.js';

const knowledgeSearchLimit = z
  .number()
  .int()
  .min(1)
  .max(20)
  .default(5)
  .describe('Maximum number of results to return.');

const inputSchema = {
  absoluteCurrentWorkingDirectory,
  knowledgeSearchQuery,
  knowledgeSearchLimit,
};

export interface KnowledgeSearchResponse {
  total: number;
  results: {
    title: string;
    description: string;
    url: string;
    score: number;
  }[];
}

type InputSchemaType = z.infer<z.ZodObject<typeof inputSchema>>;

const toolName: string = 'search-knowledge-base';

// The HubSpot Knowledge Base (knowledge.hubspot.com) is hosted on the blog
// system in HubSpot's own portal, so results are scoped by domain and portal.
const KNOWLEDGE_BASE_DOMAIN = 'knowledge.hubspot.com';
const KNOWLEDGE_BASE_PORTAL_ID = 53;

// The knowledge base has no developer API/feature tier data, so redirect those
// questions to the docs even when the model reaches this tool by mistake.
const DEV_TIER_ROUTING_HINT =
  'Note: the knowledge base does not cover developer API or feature tier requirements. For whether an API or feature is available on a subscription tier, use search-docs then fetch-doc.';

export class KnowledgeSearchTool extends Tool<InputSchemaType> {
  constructor(mcpServer: McpServer, logger: McpLogger) {
    super(mcpServer, logger, toolName);
  }

  protected getTrackingMeta(
    _input: InputSchemaType
  ): { [key: string]: string } | undefined {
    return { mode: 'knowledge-search' };
  }

  async handler({
    knowledgeSearchQuery,
    knowledgeSearchLimit,
    absoluteCurrentWorkingDirectory,
  }: InputSchemaType): Promise<McpToolResponse> {
    setupHubSpotConfig(absoluteCurrentWorkingDirectory);

    try {
      const params = new URLSearchParams({
        term: knowledgeSearchQuery,
        type: 'BLOG_POST',
        domain: KNOWLEDGE_BASE_DOMAIN,
        portalId: String(KNOWLEDGE_BASE_PORTAL_ID),
        limit: String(knowledgeSearchLimit),
      });

      const response = await http.get<KnowledgeSearchResponse>({
        url: `https://api.hubapi.com/contentsearch/v2/search?${params}`,
      });

      const { total, results } = response.data;
      if (!results || results.length === 0) {
        return formatTextContents(
          'No knowledge base articles found for your query.',
          DEV_TIER_ROUTING_HINT
        );
      }

      const formattedResults = results
        .map(
          result =>
            `**${result.title}**\n${result.description}\nURL: ${result.url}\nScore: ${result.score}\n---\n`
        )
        .join('\n');

      const successMessage = `Found ${total} results, showing top ${results.length}:\n\n${formattedResults}`;
      return formatTextContents(successMessage, DEV_TIER_ROUTING_HINT);
    } catch (error) {
      this.logger.debug(toolName, {
        message: 'Handler caught error',
        error: getErrorMessage(error),
      });
      if (isHubSpotHttpError(error)) {
        return formatTextContents(error.toString());
      }

      const errorMessage = `Error searching the knowledge base: ${getErrorMessage(error)}`;
      return formatTextContents(errorMessage);
    }
  }

  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'Search HubSpot Knowledge Base',
        description:
          'Do not use this to find whether a developer API or feature is available on a subscription tier or plan (for example "is the content audit API available on Content Hub Professional"). Use `search-docs` then `fetch-doc` for that. Use this only for how-to guidance on using HubSpot products and features, and for account or subscription settings. This searches the HubSpot Knowledge Base (knowledge.hubspot.com) and returns the most relevant help articles, each with a URL.',
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
