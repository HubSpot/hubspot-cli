import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerProjectTools, registerCmsTools } from './tools/index.js';

const server = new McpServer({
  name: 'HubSpot CLI MCP Server',
  version: '0.0.1',
  description: 'Helps perform tasks for local development of HubSpot projects.',
  capabilities: {
    tools: {},
    prompts: {},
  },
});

registerProjectTools(server);
registerCmsTools(server);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
server.connect(transport);
