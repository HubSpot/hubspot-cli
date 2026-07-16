export const MCP_SERVER_NAME = 'HubSpotDev';

export type McpClientId =
  'codex' | 'claude' | 'cursor' | 'gemini' | 'vscode' | 'windsurf';

type McpClientDetection = {
  type: 'json' | 'text';
  pathSegments: string[];
};

export type McpClient = {
  id: McpClientId;
  detection: McpClientDetection;
};

function getVsCodeMcpConfigPathSegments(): string[] {
  if (process.platform === 'darwin') {
    return ['Library', 'Application Support', 'Code', 'User', 'mcp.json'];
  }

  if (process.platform === 'win32') {
    return ['AppData', 'Roaming', 'Code', 'User', 'mcp.json'];
  }

  return ['.config', 'Code', 'User', 'mcp.json'];
}

export const MCP_CLIENTS: McpClient[] = [
  {
    id: 'codex',
    detection: {
      type: 'text',
      pathSegments: ['.codex', 'config.toml'],
    },
  },
  {
    id: 'claude',
    detection: { type: 'json', pathSegments: ['.claude.json'] },
  },
  {
    id: 'cursor',
    detection: { type: 'json', pathSegments: ['.cursor', 'mcp.json'] },
  },
  {
    id: 'gemini',
    detection: {
      type: 'json',
      pathSegments: ['.gemini', 'settings.json'],
    },
  },
  {
    id: 'vscode',
    detection: {
      type: 'json',
      pathSegments: getVsCodeMcpConfigPathSegments(),
    },
  },
  {
    id: 'windsurf',
    detection: {
      type: 'json',
      pathSegments: ['.codeium', 'windsurf', 'mcp_config.json'],
    },
  },
];

export function getMcpClientPathSegments(id: McpClientId): string[] {
  const client = MCP_CLIENTS.find(c => c.id === id);
  if (!client) {
    return [];
  }
  return client.detection.pathSegments;
}
