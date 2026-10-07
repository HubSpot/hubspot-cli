import { TextContent, McpToolResponse } from '../../types.js';
import { Tool, ToolExtra } from '../../Tool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../utils/logger.js';
import { z } from 'zod';
import {
  APP_AUTH_TYPES,
  APP_DISTRIBUTION_TYPES,
} from '../../../lib/constants.js';
import { HubSpotCommand } from '../../utils/command.js';
import {
  absoluteCurrentWorkingDirectory,
  absoluteProjectPath,
  features,
} from './constants.js';
import { formatTextContents, formatTextContent } from '../../utils/content.js';
import { setupHubSpotConfig } from '../../utils/config.js';
import { parseCommandJsonOutput } from '../../utils/json.js';
import { ProjectAddSchema } from '../../../lib/jsonOutput/projectAdd.js';

const inputSchema = {
  absoluteProjectPath,
  absoluteCurrentWorkingDirectory,
  addApp: z
    .boolean()
    .describe(
      'Should an app be added?  If there is no app in the project, an app must be added to add a feature'
    ),
  distribution: z
    .enum([APP_DISTRIBUTION_TYPES.MARKETPLACE, APP_DISTRIBUTION_TYPES.PRIVATE])
    .describe(
      'If not specified by the user, DO NOT choose for them.  This cannot be changed after a project is uploaded. Private is used if you do not wish to distribute your app on the HubSpot marketplace. '
    )
    .optional(),
  auth: z
    .enum([APP_AUTH_TYPES.STATIC, APP_AUTH_TYPES.OAUTH])
    .describe(
      'If not specified by the user, DO NOT choose for them.  This cannot be changed after a project is uploaded. Static uses a static non changing authentication token, and is only available for private distribution. '
    )
    .optional(),
  features,
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({
  ...inputSchema,
});

export type AddFeatureInputSchema = z.infer<typeof inputSchemaZodObject>;

const toolName: string = 'add-feature-to-project';
export class AddFeatureToProjectTool extends Tool<AddFeatureInputSchema> {
  constructor(mcpServer: McpServer, logger: McpLogger) {
    super(mcpServer, logger, toolName);
  }

  async handler(
    {
      absoluteProjectPath,
      absoluteCurrentWorkingDirectory,
      distribution,
      auth,
      features,
      addApp,
    }: AddFeatureInputSchema,
    extra?: ToolExtra
  ): Promise<McpToolResponse> {
    setupHubSpotConfig(absoluteCurrentWorkingDirectory);

    const command = new HubSpotCommand('project add', [
      { name: 'json', value: true },
    ]);

    const content: TextContent[] = [];

    if (distribution) {
      command.addFlag('distribution', distribution);
    } else if (addApp) {
      content.push(
        formatTextContent(
          `Ask the user how they would you like to distribute the app. Options are ${APP_DISTRIBUTION_TYPES.MARKETPLACE} and ${APP_DISTRIBUTION_TYPES.PRIVATE}`
        )
      );
    }

    if (auth) {
      command.addFlag('auth', auth);
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
        structuredContent: {},
      };
    }

    // If features isn't provided, pass an empty array to bypass the prompt
    command.addFlag('features', features || []);

    const { stdout, stderr } = await this.runCommand(
      absoluteProjectPath,
      command,
      extra
    );

    const response = await formatTextContents(stdout, stderr);
    response.structuredContent =
      parseCommandJsonOutput(stdout, ProjectAddSchema, this.logger, toolName) ??
      {};

    return response;
  }

  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'Add feature to HubSpot Project',
        description: `Adds a feature to an existing HubSpot project.
          Only works for projects with platformVersion '2025.2' and beyond. If you do not know the project path, use the find-projects tool first to locate HubSpot projects in the workspace.`,
        inputSchema,
        outputSchema: ProjectAddSchema.shape,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      (input, extra) => this.wrappedHandler(input, extra)
    );
  }
}
