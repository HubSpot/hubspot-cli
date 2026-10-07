import { McpToolResponse } from '../../types.js';
import { Tool, ToolExtra } from '../../Tool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../utils/logger.js';
import { z } from 'zod';
import { HubSpotCommand } from '../../utils/command.js';

import { absoluteProjectPath, confirmProductionAccount } from './constants.js';
import {
  formatErrorTextContents,
  formatTextContents,
} from '../../utils/content.js';
import { setupHubSpotConfig } from '../../utils/config.js';
import { parseCommandJsonOutput } from '../../utils/json.js';
import { ProjectDeploySchema } from '../../../lib/jsonOutput/projectDeploy.js';
import { getProjectConfig } from '../../../lib/projects/config.js';
import { discoverAccountTargets } from '../../../lib/accountTargetDiscovery.js';
import {
  confirmProductionTargets,
  setTargetAccount,
} from './productionConfirmation.js';

const inputSchema = {
  absoluteProjectPath,
  buildNumber: z
    .optional(z.number())
    .describe(
      'The build number to deploy. This can be found in the project details page using `hs project open`. If omitted, the tool deploys nothing and returns the recent builds, so you can ask the user which one to deploy.'
    ),
  confirmProductionAccount,
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({
  ...inputSchema,
});

type InputSchemaType = z.infer<typeof inputSchemaZodObject>;

const toolName: string = 'deploy-project';

export class DeployProjectTool extends Tool<InputSchemaType> {
  constructor(mcpServer: McpServer, logger: McpLogger) {
    super(mcpServer, logger, toolName);
  }
  async handler(
    {
      absoluteProjectPath,
      buildNumber,
      confirmProductionAccount,
    }: InputSchemaType,
    extra?: ToolExtra
  ): Promise<McpToolResponse> {
    setupHubSpotConfig(absoluteProjectPath);

    const { projectDir, projectConfig } = getProjectConfig(absoluteProjectPath);
    const targets = await discoverAccountTargets({ projectDir, projectConfig });

    if (!buildNumber) {
      const listBuildsCommand = new HubSpotCommand('project list-builds', [
        { name: 'limit', value: 100 },
      ]);
      setTargetAccount(listBuildsCommand, targets);

      const { stdout } = await this.runCommand(
        absoluteProjectPath,
        listBuildsCommand,
        extra
      );
      return formatErrorTextContents(
        `Ask the user which build number they would like to deploy?  Build information: ${stdout}`
      );
    }

    const blockedResponse = await confirmProductionTargets(
      this.mcpServer,
      this.logger,
      {
        targets,
        action: `Deploy build #${buildNumber}`,
        toolName,
        confirmedInConversation: confirmProductionAccount,
      }
    );

    if (blockedResponse) {
      return blockedResponse;
    }

    const command = new HubSpotCommand('project deploy', [
      { name: 'build', value: buildNumber },
      { name: 'json', value: true },
    ]);
    setTargetAccount(command, targets);

    const { stdout, stderr } = await this.runCommand(
      absoluteProjectPath,
      command,
      extra
    );

    const response = await formatTextContents(stdout, stderr);

    response.structuredContent =
      parseCommandJsonOutput(
        stdout,
        ProjectDeploySchema,
        this.logger,
        toolName
      ) ?? {};

    return response;
  }

  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'Deploy a build of HubSpot Project',
        description:
          'Takes a build number and a project name and deploys that build of the project. DO NOT run this tool unless the user specifies they would like to deploy the project. Deploys to production accounts require confirmation from the user. If you do not know the project path, use the find-projects tool first to locate HubSpot projects in the workspace.',
        inputSchema,
        outputSchema: ProjectDeploySchema.shape,
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      (input, extra) => this.wrappedHandler(input, extra)
    );
  }
}
