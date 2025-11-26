import path from 'path';
import z from 'zod';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAllHsProfiles } from '@hubspot/project-parsing-lib';
import { getProjectConfig } from '../../../lib/projects/config.js';
import { TextContent, TextContentResponse, Tool } from '../../types.js';
import { runCommandInDir } from '../../utils/project.js';
import {
  absoluteCurrentWorkingDirectory,
  absoluteProjectPath,
} from './constants.js';
import { formatTextContent, formatTextContents } from '../../utils/content.js';
import { trackToolUsage } from '../../utils/toolUsageTracking.js';
import { addFlag } from '../../utils/command.js';

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
      'CRITICAL: If the user has not explicitly specified a profile name, you MUST ask them which profile to use. NEVER automatically choose a profile based on files you see in the directory (e.g., seeing "hsprofile.prod.json" does NOT mean you should use "prod"). The profile to be used for the upload. All projects configured to use profiles must specify a profile when uploading. Profile files have the following format: "hsprofile.<profile>.json".'
    ),
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({
  ...inputSchema,
});

type InputSchemaType = z.infer<typeof inputSchemaZodObject>;
const toolName: string = 'upload-project';

export class UploadProjectTools extends Tool<InputSchemaType> {
  constructor(mcpServer: McpServer) {
    super(mcpServer);
  }
  async handler({
    absoluteProjectPath,
    absoluteCurrentWorkingDirectory,
    profile,
    uploadMessage,
  }: InputSchemaType): Promise<TextContentResponse> {
    await trackToolUsage(toolName);

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

    return formatTextContents(absoluteCurrentWorkingDirectory, stdout, stderr);
  }
  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'Upload HubSpot Project',
        description:
          'DO NOT run this tool unless the user specifies they would like to upload the project, it is potentially destructive. Uploads the HubSpot project in current working directory.  If the project does not exist, it will be created. MUST be ran from within the project directory.',
        inputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      this.handler
    );
  }
}
