import {
  McpServer,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';

export class Tool<InputSchema, ResponseType = TextContentResponse> {
  protected mcpServer: McpServer;
  constructor(mcpServer: McpServer) {
    this.mcpServer = mcpServer;
  }
  register(): RegisteredTool {
    throw new Error('Must implement register');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handler(input: InputSchema): ResponseType | Promise<ResponseType> {
    throw new Error('Must implement handler');
  }
}

export type TextContent = { type: 'text'; text: string };

export type TextContentResponse = { content: TextContent[] };
