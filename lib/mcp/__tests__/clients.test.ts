describe('lib/mcp/clients', () => {
  const originalPlatform = process.platform;

  async function importClientsForPlatform(platform = originalPlatform) {
    vi.resetModules();
    Object.defineProperty(process, 'platform', {
      value: platform,
    });
    return import('../clients.js');
  }

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
    });
    vi.resetModules();
  });

  it('exposes the Dev MCP server config key', async () => {
    const { MCP_SERVER_NAME } = await importClientsForPlatform();

    expect(MCP_SERVER_NAME).toBe('HubSpotDev');
  });

  it('lists each supported client exactly once', async () => {
    const { MCP_CLIENTS } = await importClientsForPlatform();

    const ids = MCP_CLIENTS.map(client => client.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      'codex',
      'claude',
      'cursor',
      'gemini',
      'vscode',
      'devin',
      'opencode',
    ]);
  });

  it('resolves client config paths', async () => {
    const { getMcpClientPathSegments } = await importClientsForPlatform();

    expect(getMcpClientPathSegments('cursor')).toEqual(['.cursor', 'mcp.json']);
    expect(getMcpClientPathSegments('devin')).toEqual([
      '.codeium',
      'windsurf',
      'mcp_config.json',
    ]);
    expect(getMcpClientPathSegments('opencode')).toEqual([
      '.config',
      'opencode',
      'config.json',
    ]);
  });

  it('resolves the VS Code config path on macOS', async () => {
    const { getMcpClientPathSegments } =
      await importClientsForPlatform('darwin');

    expect(getMcpClientPathSegments('vscode')).toEqual([
      'Library',
      'Application Support',
      'Code',
      'User',
      'mcp.json',
    ]);
  });

  it('resolves the VS Code config path on Windows', async () => {
    const { getMcpClientPathSegments } =
      await importClientsForPlatform('win32');

    expect(getMcpClientPathSegments('vscode')).toEqual([
      'AppData',
      'Roaming',
      'Code',
      'User',
      'mcp.json',
    ]);
  });

  it('resolves the VS Code config path on Linux', async () => {
    const { getMcpClientPathSegments } =
      await importClientsForPlatform('linux');

    expect(getMcpClientPathSegments('vscode')).toEqual([
      '.config',
      'Code',
      'User',
      'mcp.json',
    ]);
  });
});
