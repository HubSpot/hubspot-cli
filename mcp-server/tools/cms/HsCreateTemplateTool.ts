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
import { TEMPLATE_TYPES } from '../../../types/Cms.js';

const inputSchema = {
  absoluteCurrentWorkingDirectory,
  userSuppliedName: z
    .string()
    .describe(
      'REQUIRED - If not specified by the user, DO NOT choose. Ask the user to specify the name of the template they want to create.'
    )
    .optional(),
  dest: z
    .string()
    .describe(
      'The destination path where the template should be created on the current computer.'
    )
    .optional(),
  templateType: z
    .enum(TEMPLATE_TYPES)
    .describe(
      `Template type for template creation. Must be one of: ${TEMPLATE_TYPES.join(', ')}`
    )
    .optional(),
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({ ...inputSchema });

export type HsCreateTemplateInputSchema = z.infer<typeof inputSchemaZodObject>;

const toolName: string = 'create-cms-template';

export class HsCreateTemplateTool extends Tool<HsCreateTemplateInputSchema> {
  constructor(mcpServer: McpServer) {
    super(mcpServer);
  }

  async handler({
    userSuppliedName,
    dest,
    templateType,
    absoluteCurrentWorkingDirectory,
  }: HsCreateTemplateInputSchema): Promise<TextContentResponse> {
    await trackToolUsage(toolName);

    const content: TextContent[] = [];

    // Always require a name
    if (!userSuppliedName) {
      content.push(
        formatTextContent(
          `Ask the user to specify the name of the template they want to create.`
        )
      );
    }

    // Require template type
    if (!templateType) {
      content.push(
        formatTextContent(
          `Ask the user what template type they want to create. Options are: ${TEMPLATE_TYPES.join(', ')}`
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
    let command = 'hs create template';

    if (userSuppliedName) {
      command += ` "${userSuppliedName}"`;
    }

    if (dest) {
      command += ` "${dest}"`;
    }

    // Add template type flag
    if (templateType) {
      command = addFlag(command, 'template-type', templateType);
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
        title: 'Create HubSpot CMS Template',
        description: `Creates a new HubSpot CMS template using the hs create template command. Templates can be created non-interactively by specifying templateType. Supports all template types including: ${TEMPLATE_TYPES.join(', ')}.`,
        inputSchema,
      },
      this.handler
    );
  }
}
