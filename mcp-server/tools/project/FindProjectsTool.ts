import { TextContentResponse } from '../../types.js';
import { Tool } from '../../Tool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../utils/logger.js';
import { z } from 'zod';
import { formatTextContents } from '../../utils/content.js';
import { walk } from '@hubspot/local-dev-lib/fs';
import path from 'path';
import { PROJECT_CONFIG_FILE } from '../../../lib/constants.js';

const TOOL_NAME = 'find-projects';

const IGNORE_DIRS = ['node_modules', '.git', '.vite'];

const inputSchema = {
  absoluteDirectory: z
    .string()
    .describe(
      'The absolute path to the directory to search for HubSpot projects in.'
    ),
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({ ...inputSchema });

export type FindProjectsInputSchema = z.infer<typeof inputSchemaZodObject>;

export class FindProjectsTool extends Tool<FindProjectsInputSchema> {
  constructor(mcpServer: McpServer, logger: McpLogger) {
    super(mcpServer, logger, TOOL_NAME);
  }

  async handler({
    absoluteDirectory,
  }: FindProjectsInputSchema): Promise<TextContentResponse> {
    try {
      const allFiles = await walk(absoluteDirectory, IGNORE_DIRS);
      const projectFiles = allFiles.filter(
        file => path.basename(file) === PROJECT_CONFIG_FILE
      );

      if (projectFiles.length === 0) {
        return formatTextContents(
          `No ${PROJECT_CONFIG_FILE} files found under ${absoluteDirectory}.`
        );
      }

      const projectDirs = projectFiles.map(file => path.dirname(file));
      const output = [
        `Found ${projectFiles.length} project(s):`,
        '',
        ...projectDirs.map(dir => `  ${dir}`),
      ].join('\n');

      return formatTextContents(output);
    } catch (error) {
      this.logger.debug(TOOL_NAME, {
        message: 'Handler caught error',
        error: error instanceof Error ? error.message : String(error),
      });
      const cause = error instanceof Error ? error.cause : undefined;
      const causeMessage = cause instanceof Error ? `: ${cause.message}` : '';
      const errorMessage =
        error instanceof Error
          ? error.message || `FileSystemError${causeMessage}`
          : String(error);
      return formatTextContents(
        `Error searching for projects: ${errorMessage}`
      );
    }
  }

  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      TOOL_NAME,
      {
        title: 'Find HubSpot Projects',
        description:
          'Use this tool to locate HubSpot projects. Traverses child directories of the given directory to find hsproject.json files, returning the paths of all discovered HubSpot projects.',
        inputSchema,
        annotations: {
          readOnlyHint: true,
          openWorldHint: false,
          idempotentHint: true,
        },
      },
      input => this.wrappedHandler(input)
    );
  }
}
