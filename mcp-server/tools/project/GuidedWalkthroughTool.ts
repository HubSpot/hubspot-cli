import { TextContentResponse, Tool } from '../../types.js';
import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { execAsync } from '../../utils/command.js';
import { formatTextContents } from '../../utils/content.js';
import { trackToolUsage } from '../../utils/toolUsageTracking.js';
import { absoluteCurrentWorkingDirectory } from './constants.js';

const nextCommands = {
  'hs init': 'hs auth',
  'hs auth': 'hs project create',
  'hs project create': 'hs project upload',
  'hs project upload': 'hs project dev',
};

const inputSchema = {
  absoluteCurrentWorkingDirectory,
  command: z
    .union([
      z.literal('hs init'),
      z.literal('hs auth'),
      z.literal('hs project create'),
      z.literal('hs project upload'),
    ])
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
  constructor(mcpServer: McpServer) {
    super(mcpServer);
  }
  async handler({
    absoluteCurrentWorkingDirectory,
    command,
  }: InputSchemaType): Promise<TextContentResponse> {
    await trackToolUsage(toolName);
    if (command) {
      const { stdout } = await execAsync(`${command} --help`);
      return formatTextContents(
        absoluteCurrentWorkingDirectory,
        `Display this help output for the user amd wait for them to acknowledge: ${stdout}. ${nextCommands[command] ? `Once they are ready, A good command to look at next is ${nextCommands[command]}` : ''}`
      );
    }

    return formatTextContents(
      absoluteCurrentWorkingDirectory,
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
      },
      this.handler
    );
  }
}
