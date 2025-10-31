import { TextContentResponse, Tool } from '../../types.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { formatTextContents } from '../../utils/content.js';
import { absoluteCurrentWorkingDirectory } from './constants.js';
import {
  getIntermediateRepresentationSchema,
  mapToInternalType,
} from '@hubspot/project-parsing-lib';
import { isV2Project } from '../../../lib/projects/platformVersion.js';
import { getAccountIdFromCliConfig } from '../../utils/cliConfig.js';

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
  constructor(mcpServer: McpServer) {
    super(mcpServer);
  }
  async handler({
    absoluteCurrentWorkingDirectory,
    platformVersion,
    featureType,
  }: InputSchemaType): Promise<TextContentResponse> {
    try {
      if (!isV2Project(platformVersion)) {
        return formatTextContents(
          absoluteCurrentWorkingDirectory,
          `Can only be used on projects with a minimum platformVersion of 2025.2`
        );
      }

      const accountId = getAccountIdFromCliConfig(
        absoluteCurrentWorkingDirectory
      );

      if (!accountId) {
        const authErrorMessage = `No account ID found. Please run \`hs account auth\` to configure an account, or set a default account with \`hs account use <account>\``;
        return formatTextContents(
          absoluteCurrentWorkingDirectory,
          authErrorMessage
        );
      }

      const schema = await getIntermediateRepresentationSchema({
        platformVersion,
        projectSourceDir: '',
        accountId,
      });

      const internalComponentType = mapToInternalType(featureType);

      if (schema[internalComponentType]) {
        return formatTextContents(
          absoluteCurrentWorkingDirectory,
          JSON.stringify({ config: schema[internalComponentType] })
        );
      }
    } catch (error) {}

    return formatTextContents(
      absoluteCurrentWorkingDirectory,
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
      },
      this.handler
    );
  }
}
