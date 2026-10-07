import path from 'path';
import z from 'zod';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../utils/logger.js';
import { getAllHsProfiles } from '@hubspot/project-parsing-lib/profiles';
import { getProjectConfig } from '../../../lib/projects/config.js';
import { McpToolResponse } from '../../types.js';
import { Tool, ToolExtra } from '../../Tool.js';
import { absoluteProjectPath, confirmProductionAccount } from './constants.js';
import {
  formatErrorTextContents,
  formatTextContent,
  formatTextContents,
} from '../../utils/content.js';
import { HubSpotCommand } from '../../utils/command.js';
import { setupHubSpotConfig } from '../../utils/config.js';
import { parseCommandJsonOutput } from '../../utils/json.js';
import { ProjectUploadSchema } from '../../../lib/jsonOutput/projectUpload.js';
import { discoverAccountTargets } from '../../../lib/accountTargetDiscovery.js';
import { generateProfilePromptOption } from '../../../lib/prompts/projectProfilePrompt.js';
import { elicitSelection } from '../../utils/elicitSelection.js';
import {
  confirmProductionTargets,
  setTargetAccount,
} from './productionConfirmation.js';

const inputSchema = {
  absoluteProjectPath,
  uploadMessage: z
    .string()
    .describe(
      'A 1 sentence message that concisely describes the changes that are being uploaded.'
    ),
  profile: z
    .optional(z.string())
    .describe(
      'The profile to use for the upload. Only set this when the user names a profile. If it is omitted and the project uses profiles, the tool asks the user to choose one. NEVER automatically choose a profile based on files you see. Profile files have the format: "hsprofile.<profile>.json".'
    ),
  confirmProductionAccount,
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({
  ...inputSchema,
});

type InputSchemaType = z.infer<typeof inputSchemaZodObject>;
const toolName: string = 'upload-project';

export class UploadProjectTools extends Tool<InputSchemaType> {
  constructor(mcpServer: McpServer, logger: McpLogger) {
    super(mcpServer, logger, toolName);
  }
  async handler(
    {
      absoluteProjectPath,
      profile,
      uploadMessage,
      confirmProductionAccount,
    }: InputSchemaType,
    extra?: ToolExtra
  ): Promise<McpToolResponse> {
    setupHubSpotConfig(absoluteProjectPath);

    const { projectDir, projectConfig } = getProjectConfig(absoluteProjectPath);

    let selectedProfile = profile;

    if (!selectedProfile) {
      const profiles = await getAllHsProfiles(
        path.join(projectDir, projectConfig.srcDir)
      );

      if (profiles.length > 0) {
        const options = profiles.map(profileName => ({
          value: profileName,
          label: generateProfilePromptOption(
            projectDir,
            projectConfig,
            profileName
          ).name,
        }));

        selectedProfile = await elicitSelection(this.mcpServer, this.logger, {
          message: 'Select the profile to use for the upload.',
          title: 'Project profile',
          options,
        });

        if (!selectedProfile) {
          return formatErrorTextContents(
            `Several profiles are available. Ask the user which to use, then call ${toolName} again with the profile argument set to one of these profile names: ${options
              .map(option => option.value)
              .join(', ')}. The profiles target these accounts: ${options
              .map(option => option.label)
              .join(', ')}.`
          );
        }
      }
    }

    const targets = await discoverAccountTargets({
      projectDir,
      projectConfig,
      profileName: selectedProfile,
    });

    const blockedResponse = await confirmProductionTargets(
      this.mcpServer,
      this.logger,
      {
        targets,
        action: `Upload ${projectConfig.name}`,
        toolName,
        confirmedInConversation: confirmProductionAccount,
      }
    );

    if (blockedResponse) {
      return blockedResponse;
    }

    const command = new HubSpotCommand('project upload', [
      { name: 'force', value: true },
      { name: 'json', value: true },
    ]);

    if (uploadMessage) {
      command.addFlag('message', uploadMessage);
    }

    setTargetAccount(command, targets, selectedProfile);

    const { stdout, stderr } = await this.runCommand(
      absoluteProjectPath,
      command,
      extra
    );

    const response = await formatTextContents(stdout, stderr);

    // Add reminder about cards needing to be added to views
    response.content.push(
      formatTextContent(
        '\nIMPORTANT: If this project contains cards, remember that uploading does NOT make them live automatically. Cards must be manually added to a view in HubSpot to become visible to users.'
      )
    );

    response.structuredContent =
      parseCommandJsonOutput(
        stdout,
        ProjectUploadSchema,
        this.logger,
        toolName
      ) ?? {};

    return response;
  }
  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'Upload HubSpot Project',
        description:
          'DO NOT run this tool unless the user specifies they would like to upload the project, it is potentially destructive. Uploads the HubSpot project in current working directory.  If the project does not exist, it will be created. MUST be ran from within the project directory. IMPORTANT: Uploading a project does NOT automatically make cards live or visible to users. Cards must be manually added to a view in HubSpot after upload to become visible. Uploads to production accounts require confirmation from the user. If you do not know the project path, use the find-projects tool first to locate HubSpot projects in the workspace.',
        inputSchema,
        outputSchema: ProjectUploadSchema.shape,
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
