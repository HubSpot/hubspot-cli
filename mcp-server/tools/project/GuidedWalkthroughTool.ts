import { TextContentResponse } from '../../types.js';
import { Tool } from '../../Tool.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from '../../utils/logger.js';
import { z } from 'zod';
import { execAsync } from '../../utils/command.js';
import { formatTextContents } from '../../utils/content.js';
import { absoluteCurrentWorkingDirectory } from './constants.js';
import { setupHubSpotConfig } from '../../utils/config.js';

const nextCommands = {
  'hs init': 'hs auth',
  'hs auth': 'hs project create',
  'hs project create': 'hs project upload',
  'hs project upload': 'hs project dev',
};

const inputSchema = {
  absoluteCurrentWorkingDirectory,
  command: z
    .enum(['hs init', 'hs auth', 'hs project create', 'hs project upload'])
    .describe('The command to learn more about.  Start with `hs init`')
    .optional(),
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inputSchemaZodObject = z.object({
  ...inputSchema,
});

type InputSchemaType = z.infer<typeof inputSchemaZodObject>;

const toolName: string = 'guided-walkthrough-cli';

export class GuidedWalkthroughTool extends Tool<InputSchemaType> {
  constructor(mcpServer: McpServer, logger: McpLogger) {
    super(mcpServer, logger, toolName);
  }
  async handler({
    command,
    absoluteCurrentWorkingDirectory,
  }: InputSchemaType): Promise<TextContentResponse> {
    setupHubSpotConfig(absoluteCurrentWorkingDirectory);
    if (command) {
      const { stdout } = await execAsync(`${command} --help`);
      return formatTextContents(
        `Display this help output for the user amd wait for them to acknowledge: ${stdout}. ${nextCommands[command] ? `Once they are ready, A good command to look at next is ${nextCommands[command]}` : ''}`
      );
    }

    return formatTextContents(
      'Is there another command you would like to learn more about?'
    );
  }
  register(): RegisteredTool {
    return this.mcpServer.registerTool(
      toolName,
      {
        title: 'Guided walkthrough of the CLI',
        description: 'Give the user a guided walkthrough of the HubSpot CLI.',
        inputSchema,
        annotations: {
          readOnlyHint: true,
          openWorldHint: false,
        },
      },
      input => this.wrappedHandler(input)
    );
  }
}
