import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../utils/logger.js';
import z from 'zod';
import { McpToolResponse } from '../../types.js';
import { Tool } from '../../Tool.js';
import {
  formatErrorTextContents,
  formatTextContents,
} from '../../utils/content.js';
import { absoluteCurrentWorkingDirectory, docUrl } from './constants.js';
import { http } from '@hubspot/local-dev-lib/http/unauthed';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import { setupHubSpotConfig } from '../../utils/config.js';
import { getErrorMessage } from '../../../lib/errorHandlers/index.js';

const offset = z
  .number()
  .int()
  .min(0)
  .default(0)
  .describe(
    'The character position to start reading from. When more content is available, the response gives the offset for the next part.'
  );

const maxCharacters = z
  .number()
  .int()
  .min(1000)
  .max(40000)
  .default(20000)
  .describe('The maximum number of characters to return.');

const fullDocument = z
  .boolean()
  .default(false)
  .describe(
    'Set to true to return the whole document with no character limit. This ignores offset and maxCharacters. Set this only when the user asks for the whole page.'
  );

const inputSchema = {
  docUrl,
  absoluteCurrentWorkingDirectory,
  offset,
  maxCharacters,
  fullDocument,
};

const outputSchema = {
  text: z.string(),
  offset: z.number(),
  nextOffset: z.number().optional(),
  totalCharacters: z.number(),
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({
  ...inputSchema,
});

type InputSchemaType = z.infer<typeof inputSchemaZodObject>;

const toolName: string = 'fetch-doc';

export class DocFetchTool extends Tool<InputSchemaType> {
  constructor(mcpServer: McpServer, logger: McpLogger) {
    super(mcpServer, logger, toolName);
  }

  async handler({
    docUrl,
    absoluteCurrentWorkingDirectory,
    offset,
    maxCharacters,
    fullDocument,
  }: InputSchemaType): Promise<McpToolResponse> {
    setupHubSpotConfig(absoluteCurrentWorkingDirectory);

    try {
      // Append .md extension to the URL
      const markdownUrl = `${docUrl}.md`;

      const response = await http.get<string>({
        url: markdownUrl,
      });

      const content = response.data;

      if (!content || content.trim().length === 0) {
        return formatErrorTextContents(
          'Document is empty or contains no content.'
        );
      }

      if (!fullDocument && offset >= content.length) {
        return formatErrorTextContents(
          `Offset ${offset} is past the end of the document, which has ${content.length} characters.`
        );
      }

      const start = fullDocument ? 0 : offset;
      const chunkEnd = fullDocument
        ? content.length
        : Math.min(offset + maxCharacters, content.length);
      const nextOffset = chunkEnd < content.length ? chunkEnd : undefined;
      const text = content.slice(start, chunkEnd);

      const result = await formatTextContents(
        text,
        nextOffset === undefined
          ? undefined
          : `This is part of the document (characters ${start} to ${chunkEnd} of ${content.length}). More content is available. To read the next part, call ${toolName} again with the same arguments and offset set to ${nextOffset}.`
      );
      result.structuredContent = {
        text,
        offset: start,
        nextOffset,
        totalCharacters: content.length,
      };

      return result;
    } catch (error) {
      this.logger.debug(toolName, {
        message: 'Handler caught error',
        error: error instanceof Error ? error.message : String(error),
      });
      if (isHubSpotHttpError(error)) {
        return formatErrorTextContents(error.toString());
      }

      const errorMessage = `Error fetching documentation: ${getErrorMessage(error)}`;
      return formatErrorTextContents(errorMessage);
    }
  }

  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'Fetch HubSpot Developer Documentation (single file)',
        description:
          'Always use this immediately after `search-docs` and before creating a plan, writing code, or answering technical questions. This tool retrieves the authoritative content of a HubSpot Developer Documentation page from its URL, ensuring responses are accurate, up-to-date, and grounded in the official docs. Long pages return in parts. The response says when more content is available and how to fetch the next part. Some pages include a "Supported products" section (a `<SupportedProducts .../>` tag) listing the products and subscription tiers a feature requires. Read it to tell the user whether a feature is available on their plan, stated plainly (for example "requires Content Hub Enterprise") rather than by quoting raw spec fields.',
        inputSchema,
        outputSchema,
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
      (input, extra) => this.wrappedHandler(input, extra)
    );
  }
}
