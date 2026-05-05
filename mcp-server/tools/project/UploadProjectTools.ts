import path from 'path';
import z from 'zod';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../utils/logger.js';
import { getAllHsProfiles } from '@hubspot/project-parsing-lib/profiles';
import { getProjectConfig } from '../../../lib/projects/config.js';
import { TextContent, TextContentResponse } from '../../types.js';
import { Tool } from '../../Tool.js';
import { runCommandInDir } from '../../utils/command.js';
import {
  absoluteCurrentWorkingDirectory,
  absoluteProjectPath,
} from './constants.js';
import { formatTextContent, formatTextContents } from '../../utils/content.js';
import { addFlag } from '../../utils/command.js';
import { setupHubSpotConfig } from '../../utils/config.js';

const inputSchema = {
  absoluteProjectPath,
  absoluteCurrentWorkingDirectory,
  uploadMessage: z
    .string()
    .describe(
      'A 1 sentence message that concisely describes the changes that are being uploaded.'
    ),
  profile: z
    .optional(z.string())
    .describe(
      'The profile to use for the upload. Only required for projects configured with profiles. If the project uses profiles and the user has not specified one, ask them rather than inferring from filenames in the directory. NEVER automatically choose a profile based on files you see. Profile files have the format: "hsprofile.<profile>.json".'
    ),
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
  async handler({
    absoluteProjectPath,
    absoluteCurrentWorkingDirectory,
    profile,
    uploadMessage,
  }: InputSchemaType): Promise<TextContentResponse> {
    setupHubSpotConfig(absoluteCurrentWorkingDirectory);

    let command = addFlag('hs project upload', 'force-create', true);

    const content: TextContent[] = [];

    if (uploadMessage) {
      command = addFlag(command, 'message', uploadMessage);
    }

    if (profile) {
      command = addFlag(command, 'profile', profile);
    } else {
      let hasProfiles = false;

      try {
        const { projectConfig } = await getProjectConfig(absoluteProjectPath);
        if (projectConfig) {
          const profiles = await getAllHsProfiles(
            path.join(absoluteProjectPath, projectConfig.srcDir)
          );
          hasProfiles = profiles.length > 0;
        }
      } catch (e) {
        this.logger.debug(toolName, {
          message: 'Handler caught error checking for profiles',
          error: e instanceof Error ? e.message : String(e),
        });
        // If any of these checks fail, the safest thing to do is to assume there are no profiles.
        hasProfiles = false;
      }

      if (hasProfiles) {
        content.push(
          formatTextContent(
            `Ask the user which profile they would like to use for the upload.`
          )
        );
      }
    }

    if (content.length > 0) {
      return {
        content,
      };
    }

    const { stdout, stderr } = await runCommandInDir(
      absoluteProjectPath,
      command
    );

    const response = await formatTextContents(stdout, stderr);

    // Add reminder about cards needing to be added to views
    response.content.push(
      formatTextContent(
        '\nIMPORTANT: If this project contains cards, remember that uploading does NOT make them live automatically. Cards must be manually added to a view in HubSpot to become visible to users.'
      )
    );

    return response;
  }
  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'Upload HubSpot Project',
        description:
          'DO NOT run this tool unless the user specifies they would like to upload the project, it is potentially destructive. Uploads the HubSpot project in current working directory.  If the project does not exist, it will be created. MUST be ran from within the project directory. IMPORTANT: Uploading a project does NOT automatically make cards live or visible to users. Cards must be manually added to a view in HubSpot after upload to become visible. If you do not know the project path, use the find-projects tool first to locate HubSpot projects in the workspace.',
        inputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      input => this.wrappedHandler(input)
    );
  }
}
