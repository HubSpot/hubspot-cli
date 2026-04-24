import { TextContentResponse } from '../../types.js';
import { Tool } from '../../Tool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../utils/logger.js';
import { z } from 'zod';
import { formatTextContents } from '../../utils/content.js';
import { absoluteCurrentWorkingDirectory } from './constants.js';
import { getIntermediateRepresentationSchema } from '@hubspot/project-parsing-lib/schema';
import { mapToInternalType } from '@hubspot/project-parsing-lib/transform';
import { isLegacyProject } from '@hubspot/project-parsing-lib/projects';
import { getConfigDefaultAccountIfExists } from '@hubspot/local-dev-lib/config';
import { setupHubSpotConfig } from '../../utils/config.js';

const inputSchema = {
  absoluteCurrentWorkingDirectory,
  platformVersion: z
    .string()
    .describe(
      'The platform version for the project. Located in the hsproject.json file.'
    ),
  featureType: z
    .string()
    .describe(
      'The type of the component to fetch the JSON schema for. This will be the `type` field in the -hsmeta.json file'
    ),
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({
  ...inputSchema,
});

type InputSchemaType = z.infer<typeof inputSchemaZodObject>;

const toolName: string = 'get-feature-config-schema';

export class GetConfigValuesTool extends Tool<InputSchemaType> {
  constructor(mcpServer: McpServer, logger: McpLogger) {
    super(mcpServer, logger, toolName);
  }
  async handler({
    platformVersion,
    featureType,
    absoluteCurrentWorkingDirectory,
  }: InputSchemaType): Promise<TextContentResponse> {
    setupHubSpotConfig(absoluteCurrentWorkingDirectory);
    try {
      if (isLegacyProject(platformVersion)) {
        return formatTextContents(
          `Can only be used on projects with a minimum platformVersion of 2025.2`
        );
      }

      const accountId = getConfigDefaultAccountIfExists()?.accountId;

      if (!accountId) {
        const authErrorMessage = `No account ID found. Please run \`hs account auth\` to configure an account, or set a default account with \`hs account use <account>\``;
        return formatTextContents(authErrorMessage);
      }

      const schema = await getIntermediateRepresentationSchema({
        platformVersion,
        projectSourceDir: '',
        accountId,
      });

      const internalComponentType = mapToInternalType(featureType);

      if (schema[internalComponentType]) {
        return formatTextContents(
          JSON.stringify({ config: schema[internalComponentType] })
        );
      }
    } catch (error) {
      this.logger.debug(toolName, {
        message: 'Handler caught error',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return formatTextContents(
      `Unable to locate JSON schema for type ${featureType}`
    );
  }

  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'Fetch the JSON Schema for component',
        description: `Fetches and returns the JSON schema for the provided feature 'type' found in -hsmeta.json file.
        This should be called before editing a '-hsmeta.json' file to get the list of possible values and restrictions on those values.
        This will only work for projects with platformVersion 2025.2 and beyond`,
        inputSchema,
        annotations: {
          readOnlyHint: true,
          openWorldHint: false,
        },
      },
      input => this.wrappedHandler(input)
    );
  }
}
