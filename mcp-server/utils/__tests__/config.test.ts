vi.mock('@hubspot/local-dev-lib/config');

const mockGetLocalConfigFilePathIfExists = vi.mocked(
  (await import('@hubspot/local-dev-lib/config')).getLocalConfigFilePathIfExists
);

const { setupHubSpotConfig } = await import('../config.js');

describe('mcp-server/utils/config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('setupHubSpotConfig', () => {
    it('should set INIT_CWD to the working directory', () => {
      mockGetLocalConfigFilePathIfExists.mockReturnValue(null);

      setupHubSpotConfig('/projects/my-app');

      expect(process.env.INIT_CWD).toBe('/projects/my-app');
    });

    it('should set HUBSPOT_CONFIG_PATH when a local config exists', () => {
      mockGetLocalConfigFilePathIfExists.mockReturnValue(
        '/projects/my-app/.hubspot/config.yml'
      );

      setupHubSpotConfig('/projects/my-app');

      expect(process.env.HUBSPOT_CONFIG_PATH).toBe(
        '/projects/my-app/.hubspot/config.yml'
      );
    });

    it('should not set HUBSPOT_CONFIG_PATH when no local config exists', () => {
      delete process.env.HUBSPOT_CONFIG_PATH;
      mockGetLocalConfigFilePathIfExists.mockReturnValue(null);

      setupHubSpotConfig('/projects/my-app');

      expect(process.env.HUBSPOT_CONFIG_PATH).toBeUndefined();
    });

    it('should not modify env when directory is empty', () => {
      process.env.INIT_CWD = '/some/previous/path';
      mockGetLocalConfigFilePathIfExists.mockReturnValue(null);

      setupHubSpotConfig('');

      expect(process.env.INIT_CWD).toBe('/some/previous/path');
    });
  });
});
