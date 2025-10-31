import { TextContent, TextContentResponse, Tool } from '../../types.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  APP_AUTH_TYPES,
  APP_DISTRIBUTION_TYPES,
} from '../../../lib/constants.js';
import { addFlag } from '../../utils/command.js';
import {
  absoluteCurrentWorkingDirectory,
  absoluteProjectPath,
  features,
} from './constants.js';
import { runCommandInDir } from '../../utils/project.js';
import { formatTextContents, formatTextContent } from '../../utils/content.js';
import { trackToolUsage } from '../../utils/toolUsageTracking.js';

const inputSchema = {
  absoluteProjectPath,
  absoluteCurrentWorkingDirectory,
  addApp: z
    .boolean()
    .describe(
      'Should an app be added?  If there is no app in the project, an app must be added to add a feature'
    ),
  distribution: z
    .optional(
      z.union([
        z.literal(APP_DISTRIBUTION_TYPES.MARKETPLACE),
        z.literal(APP_DISTRIBUTION_TYPES.PRIVATE),
      ])
    )
    .describe(
      'If not specified by the user, DO NOT choose for them.  This cannot be changed after a project is uploaded. Private is used if you do not wish to distribute your application on the HubSpot marketplace. '
    ),
  auth: z
    .optional(
      z.union([
        z.literal(APP_AUTH_TYPES.STATIC),
        z.literal(APP_AUTH_TYPES.OAUTH),
      ])
    )
    .describe(
      'If not specified by the user, DO NOT choose for them.  This cannot be changed after a project is uploaded. Static uses a static non changing authentication token, and is only available for private distribution. '
    ),
  features,
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({
  ...inputSchema,
});

export type AddFeatureInputSchema = z.infer<typeof inputSchemaZodObject>;

const toolName: string = 'add-feature-to-project';
export class AddFeatureToProjectTool extends Tool<AddFeatureInputSchema> {
  constructor(mcpServer: McpServer) {
    super(mcpServer);
  }

  async handler({
    absoluteProjectPath,
    absoluteCurrentWorkingDirectory,
    distribution,
    auth,
    features,
    addApp,
  }: AddFeatureInputSchema): Promise<TextContentResponse> {
    try {
      await trackToolUsage(toolName);
      let command = `hs project add`;

      const content: TextContent[] = [];

      if (distribution) {
        command = addFlag(command, 'distribution', distribution);
      } else if (addApp) {
        content.push(
          formatTextContent(
            `Ask the user how they would you like to distribute the application. Options are ${APP_DISTRIBUTION_TYPES.MARKETPLACE} and ${APP_DISTRIBUTION_TYPES.PRIVATE}`
          )
        );
      }

      if (auth) {
        command = addFlag(command, 'auth', auth);
      } else if (addApp) {
        content.push(
          formatTextContent(
            `Ask the user which auth type they would like to use. Options are ${APP_AUTH_TYPES.STATIC} and ${APP_AUTH_TYPES.OAUTH}`
          )
        );
      }

      if (content.length > 0) {
        return {
          content,
        };
      }

      // If features isn't provided, pass an empty array to bypass the prompt
      command = addFlag(command, 'features', features || []);

      const { stdout, stderr } = await runCommandInDir(
        absoluteProjectPath,
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
        title: 'Add feature to HubSpot Project',
        description: `Adds a feature to an existing HubSpot project.
          Only works for projects with platformVersion '2025.2' and beyond`,
        inputSchema,
      },
      this.handler
    );
  }
}
