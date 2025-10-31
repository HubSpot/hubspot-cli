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
import { CONTENT_TYPES } from '../../../types/Cms.js';

const inputSchema = {
  absoluteCurrentWorkingDirectory,
  userSuppliedName: z
    .string()
    .describe(
      'REQUIRED - If not specified by the user, DO NOT choose. Ask the user to specify the name of the module they want to create.'
    )
    .optional(),
  dest: z
    .string()
    .describe(
      'The destination path where the module should be created on the current computer.'
    )
    .optional(),
  moduleLabel: z
    .string()
    .describe(
      'Label for module creation. Required for non-interactive module creation. If not provided, ask the user to provide it.'
    )
    .optional(),
  reactType: z
    .boolean()
    .describe(
      'Whether to create a React module. If the user has not specified that they want a React module, DO NOT choose for them, ask them what type of module they want to create HubL or React.'
    )
    .optional(),
  contentTypes: z
    .string()
    .refine(
      val => {
        if (!val) return true; // optional
        const types = val.split(',').map(t => t.trim().toUpperCase());
        return types.every(type =>
          (CONTENT_TYPES as readonly string[]).includes(type)
        );
      },
      {
        message: `Content types must be a comma-separated list of valid values: ${CONTENT_TYPES.join(', ')}`,
      }
    )
    .describe(
      `Content types where the module can be used. Comma-separated list. Valid values: ${CONTENT_TYPES.join(', ')}. Defaults to "ANY".`
    )
    .optional(),
  global: z
    .boolean()
    .describe('Whether the module is global. Defaults to false.')
    .optional(),
  availableForNewContent: z
    .boolean()
    .describe(
      'Whether the module is available for new content. Defaults to true.'
    )
    .optional(),
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({ ...inputSchema });

export type HsCreateModuleInputSchema = z.infer<typeof inputSchemaZodObject>;

const toolName: string = 'create-cms-module';

export class HsCreateModuleTool extends Tool<HsCreateModuleInputSchema> {
  constructor(mcpServer: McpServer) {
    super(mcpServer);
  }

  async handler({
    userSuppliedName,
    dest,
    moduleLabel,
    reactType,
    contentTypes,
    global,
    availableForNewContent,
    absoluteCurrentWorkingDirectory,
  }: HsCreateModuleInputSchema): Promise<TextContentResponse> {
    await trackToolUsage(toolName);

    const content: TextContent[] = [];

    // Always require a name
    if (!userSuppliedName) {
      content.push(
        formatTextContent(
          `Ask the user to specify the name of the module they want to create.`
        )
      );
    }

    // Require module label
    if (!moduleLabel) {
      content.push(
        formatTextContent(`Ask the user to provide a label for the module.`)
      );
    }

    // Ask about React vs HubL if not specified
    if (reactType === undefined) {
      content.push(
        formatTextContent(
          `Ask the user what type of module they want to create: HubL or React?`
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
    let command = 'hs create module';

    if (userSuppliedName) {
      command += ` "${userSuppliedName}"`;
    }

    if (dest) {
      command += ` "${dest}"`;
    }

    // Add module-specific flags
    if (moduleLabel) {
      command = addFlag(command, 'module-label', moduleLabel);
    }

    if (reactType !== undefined) {
      command = addFlag(command, 'react-type', reactType);
    }

    if (contentTypes) {
      command = addFlag(command, 'content-types', contentTypes);
    } else {
      command = addFlag(command, 'content-types', 'ANY');
    }

    if (global !== undefined) {
      command = addFlag(command, 'global', global);
    }

    if (availableForNewContent !== undefined) {
      command = addFlag(
        command,
        'available-for-new-content',
        availableForNewContent
      );
    }

    try {
      const { stdout, stderr } = await runCommandInDir(
        absoluteCurrentWorkingDirectory,
        command
      );

      return formatTextContents(
        absoluteCurrentWorkingDirectory,
        stdout,
        stderr
      );
    } catch (error) {
      return formatTextContents(
        absoluteCurrentWorkingDirectory,
        error instanceof Error ? error.message : `${error}`
      );
    }
  }

  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'Create HubSpot CMS Module',
        description:
          'Creates a new HubSpot CMS module using the hs create module command. Modules can be created non-interactively by specifying moduleLabel and other module options. You can create either HubL or React modules by setting the reactType parameter.',
        inputSchema,
      },
      this.handler
    );
  }
}
