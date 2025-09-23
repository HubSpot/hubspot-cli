import { TextContent, TextContentResponse, Tool } from '../../types.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { addFlag } from '../../utils/command.js';

import { absoluteProjectPath } from './constants.js';
import { runCommandInDir } from '../../utils/project.js';
import { formatTextContents, formatTextContent } from '../../utils/content.js';
import { trackToolUsage } from '../../utils/toolUsageTracking.js';

const inputSchema = {
  absoluteProjectPath,
  buildNumber: z
    .optional(z.number())
    .describe(
      'The build number to be deployed.  This can be found in the project details page using `hs project open`.  If no build number is specified, the most recent build is deployed'
    ),
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({
  ...inputSchema,
});

type InputSchemaType = z.infer<typeof inputSchemaZodObject>;

const toolName: string = 'deploy-project';

export class DeployProjectTool extends Tool<InputSchemaType> {
  constructor(mcpServer: McpServer) {
    super(mcpServer);
  }
  async handler({
    absoluteProjectPath,
    buildNumber,
  }: InputSchemaType): Promise<TextContentResponse> {
    await trackToolUsage(toolName);
    let command = `hs project deploy`;
    const content: TextContent[] = [];

    if (!buildNumber) {
      const { stdout } = await runCommandInDir(
        absoluteProjectPath,
        `hs project list-builds --limit 100`
      );
      content.push(
        formatTextContent(
          `Ask the user which build number they would like to deploy?  Build information: ${stdout}`
        )
      );
    } else {
      command = addFlag(command, 'build', buildNumber);
    }

    if (content.length) {
      return {
        content,
      };
    }

    const { stdout, stderr } = await runCommandInDir(
      absoluteProjectPath,
      command
    );

    return formatTextContents(stdout, stderr);
  }

  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'Deploy a build of HubSpot Project',
        description:
          'Takes a build number and a project name and deploys that build of the project. DO NOT run this tool unless the user specifies they would like to deploy the project.',
        inputSchema,
      },
      this.handler
    );
  }
}
