import { TextContentResponse, Tool } from '../../types.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { runCommandInDir } from '../../utils/project.js';
import {
  absoluteCurrentWorkingDirectory,
  absoluteProjectPath,
} from './constants.js';
import z from 'zod';
import { formatTextContents } from '../../utils/content.js';
import { trackToolUsage } from '../../utils/toolUsageTracking.js';

const inputSchema = {
  absoluteProjectPath,
  absoluteCurrentWorkingDirectory,
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
  }: InputSchemaType): Promise<TextContentResponse> {
    await trackToolUsage(toolName);
    const { stdout, stderr } = await runCommandInDir(
      absoluteProjectPath,
      `hs project upload --force-create`
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
      },
      this.handler
    );
  }
}
