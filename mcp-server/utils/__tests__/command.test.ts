import fs from 'fs';
import path from 'path';
import type { CommandResults } from '../command.js';

const mockExecAsync = vi.fn();

vi.mock('node:child_process');
vi.mock('util', () => ({
  default: {
    promisify: () => mockExecAsync,
  },
  promisify: () => mockExecAsync,
}));
vi.mock('fs');
vi.mock('path');

// Import after mocks are set up
const { addFlag, runCommandInDir } = await import('../command.js');

const mockExistsSync = vi.mocked(fs.existsSync);
const mockMkdirSync = vi.mocked(fs.mkdirSync);
const mockResolve = vi.mocked(path.resolve);

describe('mcp-server/utils/command', () => {
  describe('addFlag', () => {
    it('should add string flag to command', () => {
      const result = addFlag('hs project create', 'name', 'test-project');
      expect(result).toBe('hs project create --name "test-project"');
    });

    it('should add number flag to command', () => {
      const result = addFlag('hs project deploy', 'build', 123);
      expect(result).toBe('hs project deploy --build "123"');
    });

    it('should add boolean flag to command', () => {
      const result = addFlag('hs project upload', 'watch', true);
      expect(result).toBe('hs project upload --watch "true"');
    });

    it('should add array flag to command', () => {
      const result = addFlag('hs project create', 'features', [
        'card',
        'settings',
      ]);
      expect(result).toBe('hs project create --features "card" "settings"');
    });

    it('should handle empty array', () => {
      const result = addFlag('hs project create', 'features', []);
      expect(result).toBe('hs project create --features ');
    });

    it('should handle array with one item', () => {
      const result = addFlag('hs project create', 'features', ['card']);
      expect(result).toBe('hs project create --features "card"');
    });

    it('should handle special characters in string values', () => {
      const result = addFlag(
        'hs project create',
        'name',
        'my-project with spaces'
      );
      expect(result).toBe('hs project create --name "my-project with spaces"');
    });

    it('should handle special characters in array values', () => {
      const result = addFlag('hs project create', 'features', [
        'card with spaces',
        'settings',
      ]);
      expect(result).toBe(
        'hs project create --features "card with spaces" "settings"'
      );
    });
  });

  describe('runCommandInDir', () => {
    const mockDirectory = '/test/directory';
    const mockCommand = 'npm install';
    const mockResolvedPath = '/resolved/test/directory';

    beforeEach(() => {
      mockResolve.mockReturnValue(mockResolvedPath);
    });

    it('should run command in existing directory', async () => {
      const expectedResult: CommandResults = {
        stdout: 'command output',
        stderr: '',
      };

      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue(expectedResult);

      const result = await runCommandInDir(mockDirectory, mockCommand);

      expect(mockExistsSync).toHaveBeenCalledWith(mockDirectory);
      expect(mockMkdirSync).not.toHaveBeenCalled();
      expect(mockResolve).toHaveBeenCalledWith(mockDirectory);
      expect(mockExecAsync).toHaveBeenCalledWith(
        mockCommand,
        expect.objectContaining({
          cwd: mockResolvedPath,
          env: expect.any(Object),
        })
      );
      expect(result).toEqual(expectedResult);
    });

    it('should create directory if it does not exist', async () => {
      const expectedResult: CommandResults = {
        stdout: 'command output',
        stderr: '',
      };

      mockExistsSync.mockReturnValue(false);
      mockExecAsync.mockResolvedValue(expectedResult);

      const result = await runCommandInDir(mockDirectory, mockCommand);

      expect(mockExistsSync).toHaveBeenCalledWith(mockDirectory);
      expect(mockMkdirSync).toHaveBeenCalledWith(mockDirectory);
      expect(mockResolve).toHaveBeenCalledWith(mockDirectory);
      expect(mockExecAsync).toHaveBeenCalledWith(
        mockCommand,
        expect.objectContaining({
          cwd: mockResolvedPath,
          env: expect.any(Object),
        })
      );
      expect(result).toEqual(expectedResult);
    });

    it('should propagate execAsync errors', async () => {
      const error = new Error('Command failed');

      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockRejectedValue(error);

      await expect(runCommandInDir(mockDirectory, mockCommand)).rejects.toThrow(
        'Command failed'
      );

      expect(mockExecAsync).toHaveBeenCalledWith(
        mockCommand,
        expect.objectContaining({
          cwd: mockResolvedPath,
          env: expect.any(Object),
        })
      );
    });

    it('should handle stderr in results', async () => {
      const expectedResult: CommandResults = {
        stdout: 'some output',
        stderr: 'warning message',
      };

      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue(expectedResult);

      const result = await runCommandInDir(mockDirectory, mockCommand);

      expect(result.stdout).toBe('some output');
      expect(result.stderr).toBe('warning message');
    });

    it('should add --disable-usage-tracking flag to hs commands', async () => {
      const hsCommand = 'hs project upload';
      const expectedResult: CommandResults = {
        stdout: 'success',
        stderr: '',
      };

      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue(expectedResult);

      await runCommandInDir(mockDirectory, hsCommand);

      expect(mockExecAsync).toHaveBeenCalledWith(
        'hs project upload --disable-usage-tracking "true"',
        expect.objectContaining({
          cwd: mockResolvedPath,
          env: expect.any(Object),
        })
      );
    });

    it('should not add --disable-usage-tracking flag to non-hs commands', async () => {
      const nonHsCommand = 'npm install';
      const expectedResult: CommandResults = {
        stdout: 'success',
        stderr: '',
      };

      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue(expectedResult);

      await runCommandInDir(mockDirectory, nonHsCommand);

      expect(mockExecAsync).toHaveBeenCalledWith(
        'npm install',
        expect.objectContaining({
          cwd: mockResolvedPath,
          env: expect.any(Object),
        })
      );
    });

    it('should add --disable-usage-tracking flag to hs commands with existing flags', async () => {
      const hsCommand = 'hs project upload --profile prod';
      const expectedResult: CommandResults = {
        stdout: 'success',
        stderr: '',
      };

      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue(expectedResult);

      await runCommandInDir(mockDirectory, hsCommand);

      expect(mockExecAsync).toHaveBeenCalledWith(
        'hs project upload --profile prod --disable-usage-tracking "true"',
        expect.objectContaining({
          cwd: mockResolvedPath,
          env: expect.any(Object),
        })
      );
    });

    it('should handle hs commands that start with whitespace', async () => {
      const hsCommand = 'hs init';
      const expectedResult: CommandResults = {
        stdout: 'success',
        stderr: '',
      };

      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue(expectedResult);

      await runCommandInDir(mockDirectory, hsCommand);

      expect(mockExecAsync).toHaveBeenCalledWith(
        'hs init --disable-usage-tracking "true"',
        expect.objectContaining({
          cwd: mockResolvedPath,
          env: expect.any(Object),
        })
      );
    });

    it('should use npx -p @hubspot/cli when HUBSPOT_MCP_STANDALONE is true', async () => {
      const originalEnv = process.env.HUBSPOT_MCP_STANDALONE;
      process.env.HUBSPOT_MCP_STANDALONE = 'true';

      const hsCommand = 'hs project upload';
      const expectedResult: CommandResults = {
        stdout: 'success',
        stderr: '',
      };

      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue(expectedResult);

      await runCommandInDir(mockDirectory, hsCommand);

      expect(mockExecAsync).toHaveBeenCalledWith(
        'npx -y -p @hubspot/cli hs project upload --disable-usage-tracking "true"',
        expect.objectContaining({
          cwd: mockResolvedPath,
          env: expect.any(Object),
        })
      );

      // Restore original env
      if (originalEnv === undefined) {
        delete process.env.HUBSPOT_MCP_STANDALONE;
      } else {
        process.env.HUBSPOT_MCP_STANDALONE = originalEnv;
      }
    });

    it('should use regular hs command when HUBSPOT_MCP_STANDALONE is not set', async () => {
      const originalEnv = process.env.HUBSPOT_MCP_STANDALONE;
      delete process.env.HUBSPOT_MCP_STANDALONE;

      const hsCommand = 'hs project upload';
      const expectedResult: CommandResults = {
        stdout: 'success',
        stderr: '',
      };

      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue(expectedResult);

      await runCommandInDir(mockDirectory, hsCommand);

      expect(mockExecAsync).toHaveBeenCalledWith(
        'hs project upload --disable-usage-tracking "true"',
        expect.objectContaining({
          cwd: mockResolvedPath,
          env: expect.any(Object),
        })
      );

      // Restore original env
      if (originalEnv !== undefined) {
        process.env.HUBSPOT_MCP_STANDALONE = originalEnv;
      }
    });

    it('should use npx -p @hubspot/cli for hs commands with flags in standalone mode', async () => {
      const originalEnv = process.env.HUBSPOT_MCP_STANDALONE;
      process.env.HUBSPOT_MCP_STANDALONE = 'true';

      const hsCommand = 'hs project upload --profile prod';
      const expectedResult: CommandResults = {
        stdout: 'success',
        stderr: '',
      };

      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue(expectedResult);

      await runCommandInDir(mockDirectory, hsCommand);

      expect(mockExecAsync).toHaveBeenCalledWith(
        'npx -y -p @hubspot/cli hs project upload --profile prod --disable-usage-tracking "true"',
        expect.objectContaining({
          cwd: mockResolvedPath,
          env: expect.any(Object),
        })
      );

      // Restore original env
      if (originalEnv === undefined) {
        delete process.env.HUBSPOT_MCP_STANDALONE;
      } else {
        process.env.HUBSPOT_MCP_STANDALONE = originalEnv;
      }
    });

    it('should use pinned CLI version when HUBSPOT_CLI_VERSION is set in standalone mode', async () => {
      const originalStandaloneEnv = process.env.HUBSPOT_MCP_STANDALONE;
      const originalVersionEnv = process.env.HUBSPOT_CLI_VERSION;
      process.env.HUBSPOT_MCP_STANDALONE = 'true';
      process.env.HUBSPOT_CLI_VERSION = '8.1.0';

      const hsCommand = 'hs project upload';
      const expectedResult: CommandResults = {
        stdout: 'success',
        stderr: '',
      };

      mockExistsSync.mockReturnValue(true);
      mockExecAsync.mockResolvedValue(expectedResult);

      await runCommandInDir(mockDirectory, hsCommand);

      expect(mockExecAsync).toHaveBeenCalledWith(
        'npx -y -p @hubspot/cli@8.1.0 hs project upload --disable-usage-tracking "true"',
        expect.objectContaining({
          cwd: mockResolvedPath,
          env: expect.any(Object),
        })
      );

      // Restore original env
      if (originalStandaloneEnv === undefined) {
        delete process.env.HUBSPOT_MCP_STANDALONE;
      } else {
        process.env.HUBSPOT_MCP_STANDALONE = originalStandaloneEnv;
      }
      if (originalVersionEnv === undefined) {
        delete process.env.HUBSPOT_CLI_VERSION;
      } else {
        process.env.HUBSPOT_CLI_VERSION = originalVersionEnv;
      }
    });
  });
});
