import { McpToolResponse } from '../../types.js';
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
import {
  formatTextContents,
  formatErrorTextContents,
} from '../../utils/content.js';
import { setupHubSpotConfig } from '../../utils/config.js';
import { getErrorMessage } from '../../../lib/errorHandlers/index.js';
import {
  HubSpotCommand,
  getCommandResultsFromError,
} from '../../utils/command.js';
import { parseCommandJsonOutput } from '../../utils/json.js';
import { ProjectValidateSchema } from '../../../lib/jsonOutput/projectValidate.js';

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
  ): Promise<McpToolResponse> {
    setupHubSpotConfig(absoluteCurrentWorkingDirectory);

    const command = new HubSpotCommand('project validate', [
      { name: 'json', value: true },
    ]);

    let stdout = '';
    let stderr = '';

    try {
      ({ stdout, stderr } = await this.runCommand(
        absoluteProjectPath,
        command,
        extra
      ));
    } catch (error) {
      this.logger.debug(toolName, {
        message: 'Handler caught error',
        error: getErrorMessage(error),
      });
      ({ stdout, stderr } = getCommandResultsFromError(error));

      if (!stdout) {
        return formatErrorTextContents(getErrorMessage(error));
      }
    }

    const structuredContent = parseCommandJsonOutput(
      stdout,
      ProjectValidateSchema,
      this.logger,
      toolName
    );

    if (!structuredContent) {
      return formatErrorTextContents(stdout, stderr);
    }

    const response = await formatTextContents(stdout, stderr);
    response.structuredContent = structuredContent;
    return response;
  }
  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'Validate HubSpot Project',
        description:
          'Validates the HubSpot project and its configuration files.  This tool does not need to be ran before uploading the project. If you do not know the project path, use the find-projects tool first to locate HubSpot projects in the workspace.',
        inputSchema,
        outputSchema: ProjectValidateSchema.shape,
        annotations: {
          readOnlyHint: true,
          openWorldHint: false,
        },
      },
      (input, extra) => this.wrappedHandler(input, extra)
    );
  }
}
