export const MCP_SERVER_NAME = 'HubSpotDev';

export type McpClientId =
  'codex' | 'claude' | 'cursor' | 'devin' | 'opencode' | 'vscode';

type McpClientDetection = {
  type: 'json' | 'text';
  pathSegments: string[];
};

export type McpClient = {
  id: McpClientId;
  detection: McpClientDetection;
  skillsPathSegments: string[];
};

const SHARED_SKILLS_PATH_SEGMENTS = ['.agents', 'skills'];

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
    skillsPathSegments: SHARED_SKILLS_PATH_SEGMENTS,
  },
  {
    id: 'claude',
    detection: { type: 'json', pathSegments: ['.claude.json'] },
    skillsPathSegments: ['.claude', 'skills'],
  },
  {
    id: 'cursor',
    detection: { type: 'json', pathSegments: ['.cursor', 'mcp.json'] },
    skillsPathSegments: SHARED_SKILLS_PATH_SEGMENTS,
  },
  {
    id: 'vscode',
    detection: {
      type: 'json',
      pathSegments: getVsCodeMcpConfigPathSegments(),
    },
    skillsPathSegments: SHARED_SKILLS_PATH_SEGMENTS,
  },
  {
    id: 'devin',
    detection: {
      type: 'json',
      pathSegments: ['.codeium', 'windsurf', 'mcp_config.json'],
    },
    skillsPathSegments: SHARED_SKILLS_PATH_SEGMENTS,
  },
  {
    id: 'opencode',
    detection: {
      type: 'json',
      pathSegments: ['.config', 'opencode', 'config.json'],
    },
    skillsPathSegments: SHARED_SKILLS_PATH_SEGMENTS,
  },
];

export function getMcpClientPathSegments(id: McpClientId): string[] {
  const client = MCP_CLIENTS.find(c => c.id === id);
  if (!client) {
    return [];
  }
  return client.detection.pathSegments;
}
