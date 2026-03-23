import { TextContentResponse, Tool } from '../../types.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  absoluteCurrentWorkingDirectory,
  absoluteProjectPath,
} from './constants.js';
import { runCommandInDir } from '../../utils/command.js';
import { formatTextContents } from '../../utils/content.js';
import { trackToolUsage } from '../../utils/toolUsageTracking.js';
import { setupHubSpotConfig } from '../../utils/config.js';
import { getErrorMessage } from '../../../lib/errorHandlers/index.js';

const inputSchema = {
  absoluteProjectPath,
  absoluteCurrentWorkingDirectory,
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({ ...inputSchema });

export type CreateProjectInputSchema = z.infer<typeof inputSchemaZodObject>;
const toolName: string = 'validate-project';

export class ValidateProjectTool extends Tool<CreateProjectInputSchema> {
  constructor(mcpServer: McpServer) {
    super(mcpServer);
  }

  async handler({
    absoluteProjectPath,
    absoluteCurrentWorkingDirectory,
  }: CreateProjectInputSchema): Promise<TextContentResponse> {
    setupHubSpotConfig(absoluteCurrentWorkingDirectory);
    await trackToolUsage(toolName);
    try {
      const { stdout, stderr } = await runCommandInDir(
        absoluteProjectPath,
        'hs project validate'
      );

      return formatTextContents(stdout, stderr);
    } catch (error) {
      return formatTextContents(getErrorMessage(error));
    }
  }
  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'Validate HubSpot Project',
        description:
          'Validates the HubSpot project and its configuration files.  This tool does not need to be ran before uploading the project',
        inputSchema,
        annotations: {
          readOnlyHint: true,
          openWorldHint: false,
        },
      },
      this.handler
    );
  }
}
