import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import z from 'zod';
import { TextContentResponse, Tool } from '../../types.js';
import { formatTextContents } from '../../utils/content.js';
import { trackToolUsage } from '../../utils/toolUsageTracking.js';
import { absoluteCurrentWorkingDirectory, docUrl } from './constants.js';
import { http } from '@hubspot/local-dev-lib/http/unauthed';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';

const inputSchema = {
  docUrl,
  absoluteCurrentWorkingDirectory,
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({
  ...inputSchema,
});

type InputSchemaType = z.infer<typeof inputSchemaZodObject>;

const toolName: string = 'fetch-doc';

export class DocFetchTool extends Tool<InputSchemaType> {
  constructor(mcpServer: McpServer) {
    super(mcpServer);
  }

  async handler({
    docUrl,
    absoluteCurrentWorkingDirectory,
  }: InputSchemaType): Promise<TextContentResponse> {
    await trackToolUsage(toolName);

    try {
      // Append .md extension to the URL
      const markdownUrl = `${docUrl}.md`;

      const response = await http.get<string>({
        url: markdownUrl,
      });

      const content = response.data;

      if (!content || content.trim().length === 0) {
        return formatTextContents(
          absoluteCurrentWorkingDirectory,
          'Document is empty or contains no content.'
        );
      }

      return formatTextContents(absoluteCurrentWorkingDirectory, content);
    } catch (error) {
      if (isHubSpotHttpError(error)) {
        return formatTextContents(
          absoluteCurrentWorkingDirectory,
          error.toString()
        );
      }

      const errorMessage = `Error fetching documentation: ${error instanceof Error ? error.message : String(error)}`;
      return formatTextContents(absoluteCurrentWorkingDirectory, errorMessage);
    }
  }

  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'Fetch HubSpot Developer Documentation (single file)',
        description:
          'Always use this immediately after `search-docs` and before creating a plan, writing code, or answering technical questions. This tool retrieves the full, authoritative content of a HubSpot Developer Documentation page from its URL, ensuring responses are accurate, up-to-date, and grounded in the official docs.',
        inputSchema,
      },
      this.handler
    );
  }
}
