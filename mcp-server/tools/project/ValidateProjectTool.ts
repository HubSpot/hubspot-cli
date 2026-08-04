import { TextContentResponse } from '../../types.js';
import { Tool, ToolExtra } from '../../Tool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../utils/logger.js';
import { z } from 'zod';
import {
  absoluteCurrentWorkingDirectory,
  absoluteProjectPath,
} from './constants.js';
import { formatTextContents } from '../../utils/content.js';
import { setupHubSpotConfig } from '../../utils/config.js';
import { getErrorMessage } from '../../../lib/errorHandlers/index.js';
import { HubSpotCommand } from '../../utils/command.js';

const inputSchema = {
  absoluteProjectPath,
  absoluteCurrentWorkingDirectory,
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({ ...inputSchema });

export type CreateProjectInputSchema = z.infer<typeof inputSchemaZodObject>;
const toolName: string = 'validate-project';

export class ValidateProjectTool extends Tool<CreateProjectInputSchema> {
  constructor(mcpServer: McpServer, logger: McpLogger) {
    super(mcpServer, logger, toolName);
  }

  async handler(
    {
      absoluteProjectPath,
      absoluteCurrentWorkingDirectory,
    }: CreateProjectInputSchema,
    extra?: ToolExtra
  ): Promise<TextContentResponse> {
    setupHubSpotConfig(absoluteCurrentWorkingDirectory);
    try {
      const command = new HubSpotCommand('project validate');
      const { stdout, stderr } = await this.runCommand(
        absoluteProjectPath,
        command,
        extra
      );

      return formatTextContents(stdout, stderr);
    } catch (error) {
      this.logger.debug(toolName, {
        message: 'Handler caught error',
        error: error instanceof Error ? error.message : String(error),
      });
      return formatTextContents(getErrorMessage(error));
    }
  }
  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'Validate HubSpot Project',
        description:
          'Validates the HubSpot project and its configuration files.  This tool does not need to be ran before uploading the project. If you do not know the project path, use the find-projects tool first to locate HubSpot projects in the workspace.',
        inputSchema,
        annotations: {
          readOnlyHint: true,
          openWorldHint: false,
        },
      },
      (input, extra) => this.wrappedHandler(input, extra)
    );
  }
}
