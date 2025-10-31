import { TextContent, TextContentResponse, Tool } from '../../types.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  APP_AUTH_TYPES,
  APP_DISTRIBUTION_TYPES,
  EMPTY_PROJECT,
  PROJECT_WITH_APP,
} from '../../../lib/constants.js';
import { addFlag } from '../../utils/command.js';
import { absoluteCurrentWorkingDirectory, features } from './constants.js';
import { runCommandInDir } from '../../utils/project.js';
import { formatTextContents, formatTextContent } from '../../utils/content.js';
import { trackToolUsage } from '../../utils/toolUsageTracking.js';

const inputSchema = {
  absoluteCurrentWorkingDirectory,
  name: z
    .string()
    .describe(
      'If not specified by the user, DO NOT choose for them.  Changing this is potentially destructive.The name of the project to be created.  This name is how your project will appear in HubSpot. '
    )
    .optional(),
  destination: z
    .string()
    .describe(
      'DO NOT use the current directory unless the user has explicitly stated to do so. Relative path to the directory the project will be created in.'
    ),
  projectBase: z
    .union([z.literal(EMPTY_PROJECT), z.literal(PROJECT_WITH_APP)])
    .describe(
      'Empty will create an empty project, and app will create a project with an app inside of it.'
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
    )
    .optional(),
  features,
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({ ...inputSchema });

export type CreateProjectInputSchema = z.infer<typeof inputSchemaZodObject>;
const toolName: string = 'create-project';

export class CreateProjectTool extends Tool<CreateProjectInputSchema> {
  constructor(mcpServer: McpServer) {
    super(mcpServer);
  }
  async handler({
    name,
    destination,
    projectBase,
    distribution,
    auth,
    features,
    absoluteCurrentWorkingDirectory,
  }: CreateProjectInputSchema): Promise<TextContentResponse> {
    await trackToolUsage(toolName);
    let command = addFlag('hs project create', 'platform-version', '2025.2');

    const content: TextContent[] = [];

    if (name) {
      command = addFlag(command, 'name', name);
    } else {
      content.push(
        formatTextContent(
          `Ask the user what they would like to name the project.`
        )
      );
    }
    if (destination) {
      command = addFlag(command, 'dest', destination);
    }
    if (projectBase) {
      command = addFlag(command, 'project-base', projectBase);
    }

    if (distribution) {
      command = addFlag(command, 'distribution', distribution);
    } else if (projectBase === PROJECT_WITH_APP) {
      content.push(
        formatTextContent(
          `Ask the user how they would you like to distribute the application? Options are ${APP_DISTRIBUTION_TYPES.MARKETPLACE} and ${APP_DISTRIBUTION_TYPES.PRIVATE}`
        )
      );
    }

    if (auth) {
      command = addFlag(command, 'auth', auth);
    } else if (projectBase === PROJECT_WITH_APP) {
      content.push(
        formatTextContent(
          `Ask the user which auth type they would like to use? Options are ${APP_AUTH_TYPES.STATIC} and ${APP_AUTH_TYPES.OAUTH}`
        )
      );
    }

    if (content.length > 0) {
      return {
        content,
      };
    }

    // Always pass features, even if it is an empty array to bypass the prompts
    command = addFlag(command, 'features', features || []);

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
        title: 'Create HubSpot Project',
        description:
          'Creates a HubSpot project with the provided name and outputs it in the provided destination',
        inputSchema,
      },
      this.handler
    );
  }
}
