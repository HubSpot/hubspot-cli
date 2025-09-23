import { TextContent, TextContentResponse, Tool } from '../../types.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { absoluteCurrentWorkingDirectory } from '../project/constants.js';
import { runCommandInDir } from '../../utils/project.js';
import { formatTextContents, formatTextContent } from '../../utils/content.js';
import { trackToolUsage } from '../../utils/toolUsageTracking.js';
import { addFlag } from '../../utils/command.js';
import { HTTP_METHODS } from '../../../types/Cms.js';

const inputSchema = {
  absoluteCurrentWorkingDirectory,
  dest: z
    .string()
    .describe(
      'The destination path where the function should be created on the current computer.'
    )
    .optional(),
  functionsFolder: z
    .string()
    .describe(
      'Folder name for function creation. Required for non-interactive function creation. If the user has not specified the folder name, ask them to provide it.'
    )
    .optional(),
  filename: z
    .string()
    .describe(
      'Function filename. Required for non-interactive function creation. If the user has not specified the filename, ask them to provide it.'
    )
    .optional(),
  endpointMethod: z
    .enum(HTTP_METHODS)
    .describe(
      `HTTP method for the function endpoint. Must be one of: ${HTTP_METHODS.join(', ')}. Defaults to GET.`
    )
    .optional(),
  endpointPath: z
    .string()
    .describe(
      'API endpoint path for the function. Required for non-interactive function creation. If the user has not specified the endpoint path, ask them to provide it.'
    )
    .optional(),
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({ ...inputSchema });

export type HsCreateFunctionInputSchema = z.infer<typeof inputSchemaZodObject>;

const toolName: string = 'create-cms-function';

export class HsCreateFunctionTool extends Tool<HsCreateFunctionInputSchema> {
  constructor(mcpServer: McpServer) {
    super(mcpServer);
  }

  async handler({
    dest,
    functionsFolder,
    filename,
    endpointMethod,
    endpointPath,
    absoluteCurrentWorkingDirectory,
  }: HsCreateFunctionInputSchema): Promise<TextContentResponse> {
    await trackToolUsage(toolName);

    const content: TextContent[] = [];

    // Require functions folder
    if (!functionsFolder) {
      content.push(
        formatTextContent(
          `Ask the user to provide the folder name for the function.`
        )
      );
    }

    // Require filename
    if (!filename) {
      content.push(
        formatTextContent(
          `Ask the user to provide the filename for the function.`
        )
      );
    }

    // Require endpoint path
    if (!endpointPath) {
      content.push(
        formatTextContent(
          `Ask the user to provide the API endpoint path for the function.`
        )
      );
    }

    // If we have missing required information, return the prompts
    if (content.length > 0) {
      return {
        content,
      };
    }

    // Build the command
    let command = 'hs create function';

    if (dest) {
      command += ` "${dest}"`;
    }

    // Add function-specific flags
    if (functionsFolder) {
      command = addFlag(command, 'functions-folder', functionsFolder);
    }

    if (filename) {
      command = addFlag(command, 'filename', filename);
    }

    if (endpointMethod) {
      command = addFlag(command, 'endpoint-method', endpointMethod);
    } else {
      command = addFlag(command, 'endpoint-method', 'GET');
    }

    if (endpointPath) {
      command = addFlag(command, 'endpoint-path', endpointPath);
    }

    try {
      const { stdout, stderr } = await runCommandInDir(
        absoluteCurrentWorkingDirectory,
        command
      );

      return formatTextContents(stdout, stderr);
    } catch (error) {
      return formatTextContents(
        error instanceof Error ? error.message : `${error}`
      );
    }
  }

  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'Create HubSpot CMS Serverless Function',
        description: `Creates a new HubSpot CMS serverless function using the hs create function command. Functions can be created non-interactively by specifying functionsFolder, filename, and endpointPath. Supports all HTTP methods (${HTTP_METHODS.join(', ')}).`,
        inputSchema,
      },
      this.handler
    );
  }
}
