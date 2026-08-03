import fs from 'fs';
import path from 'path';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

vi.mock('node:child_process');
vi.mock('fs');
vi.mock('path');

// Import after mocks are set up
const { HubSpotCommand, runCommandInDir } = await import('../command.js');

const mockSpawn = vi.mocked(spawn);
const mockExistsSync = vi.mocked(fs.existsSync);
const mockMkdirSync = vi.mocked(fs.mkdirSync);
const mockResolve = vi.mocked(path.resolve);

function createMockProcess(
  stdout = '',
  stderr = '',
  exitCode = 0,
  spawnError?: Error
) {
  const proc = new EventEmitter() as NodeJS.EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();

  mockSpawn.mockImplementation(() => {
    setTimeout(() => {
      if (spawnError) {
        proc.emit('error', spawnError);
        return;
      }
      if (stdout) proc.stdout.emit('data', Buffer.from(stdout));
      if (stderr) proc.stderr.emit('data', Buffer.from(stderr));
      proc.emit('close', exitCode);
    }, 0);
    return proc as ReturnType<typeof spawn>;
  });

  return proc;
}

describe('mcp-server/utils/command', () => {
  describe('HubSpotCommand', () => {
    it('should set executable to "hs" and split subcommand into args', () => {
      const cmd = new HubSpotCommand('project create');
      expect(cmd.executable).toBe('hs');
      expect(cmd.args).toEqual(['project', 'create']);
    });

    it('should include initial flags in args', () => {
      const cmd = new HubSpotCommand('project create', [
        { name: 'platform-version', value: '2026.03' },
      ]);
      expect(cmd.args).toEqual([
        'project',
        'create',
        '--platform-version',
        '2026.03',
      ]);
    });

    it('should append a flag and return this for chaining', () => {
      const cmd = new HubSpotCommand('project upload');
      const returned = cmd.addFlag('force', true);
      expect(returned).toBe(cmd);
      expect(cmd.args).toEqual(['project', 'upload', '--force', 'true']);
    });

    it('should support chaining multiple addFlag calls', () => {
      const cmd = new HubSpotCommand('project upload');
      cmd.addFlag('force', true).addFlag('message', 'my message');
      expect(cmd.args).toEqual([
        'project',
        'upload',
        '--force',
        'true',
        '--message',
        'my message',
      ]);
    });

    it('should expand array flag values to multiple args', () => {
      const cmd = new HubSpotCommand('project create');
      cmd.addFlag('features', ['card', 'settings']);
      expect(cmd.args).toEqual([
        'project',
        'create',
        '--features',
        'card',
        'settings',
      ]);
    });

    it('should stringify number flag values', () => {
      const cmd = new HubSpotCommand('project deploy');
      cmd.addFlag('build', 123);
      expect(cmd.args).toEqual(['project', 'deploy', '--build', '123']);
    });

    it('should stringify boolean flag values', () => {
      const cmd = new HubSpotCommand('project upload');
      cmd.addFlag('watch', false);
      expect(cmd.args).toEqual(['project', 'upload', '--watch', 'false']);
    });

    it('should handle values with spaces as a single arg entry', () => {
      const cmd = new HubSpotCommand('project create');
      cmd.addFlag('name', 'my project with spaces');
      expect(cmd.args).toEqual([
        'project',
        'create',
        '--name',
        'my project with spaces',
      ]);
    });

    it('should handle empty array flag values', () => {
      const cmd = new HubSpotCommand('project add');
      cmd.addFlag('features', []);
      expect(cmd.args).toEqual(['project', 'add', '--features']);
    });

    it('should reflect all flags on each args access (getter is computed)', () => {
      const cmd = new HubSpotCommand('project upload');
      expect(cmd.args).toEqual(['project', 'upload']);
      cmd.addFlag('force', true);
      expect(cmd.args).toEqual(['project', 'upload', '--force', 'true']);
    });
  });

  describe('runCommandInDir', () => {
    const mockDirectory = '/test/directory';
    const mockCommand = { executable: 'npm', args: ['install'] };
    const mockResolvedPath = '/resolved/test/directory';

    beforeEach(() => {
      mockResolve.mockReturnValue(mockResolvedPath);
    });

    it('should create directory if it does not exist', async () => {
      mockExistsSync.mockReturnValue(false);
      createMockProcess('command output');

      const result = await runCommandInDir(mockDirectory, mockCommand);

      expect(mockExistsSync).toHaveBeenCalledWith(mockDirectory);
      expect(mockMkdirSync).toHaveBeenCalledWith(mockDirectory);
      expect(result.stdout).toBe('command output');
    });

    it('should not create directory if it already exists', async () => {
      mockExistsSync.mockReturnValue(true);
      createMockProcess('command output');

      await runCommandInDir(mockDirectory, mockCommand);

      expect(mockExistsSync).toHaveBeenCalledWith(mockDirectory);
      expect(mockMkdirSync).not.toHaveBeenCalled();
    });

    it('should run command in resolved directory', async () => {
      mockExistsSync.mockReturnValue(true);
      createMockProcess('output');

      await runCommandInDir(mockDirectory, mockCommand);

      expect(mockResolve).toHaveBeenCalledWith(mockDirectory);
      expect(mockSpawn).toHaveBeenCalledWith(
        'npm',
        ['install'],
        expect.objectContaining({ cwd: mockResolvedPath })
      );
    });

    it('should add --disable-usage-tracking flag to hs commands', async () => {
      mockExistsSync.mockReturnValue(true);
      createMockProcess('success');

      await runCommandInDir(
        mockDirectory,
        new HubSpotCommand('project upload')
      );

      expect(mockSpawn).toHaveBeenCalledWith(
        'hs',
        ['project', 'upload', '--disable-usage-tracking', 'true'],
        expect.any(Object)
      );
    });

    it('should not add --disable-usage-tracking flag to non-hs commands', async () => {
      mockExistsSync.mockReturnValue(true);
      createMockProcess('success');

      await runCommandInDir(mockDirectory, {
        executable: 'npm',
        args: ['install'],
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        'npm',
        ['install'],
        expect.any(Object)
      );
    });

    it('should set INIT_CWD env var to resolved directory', async () => {
      mockExistsSync.mockReturnValue(true);
      createMockProcess('success');

      await runCommandInDir(mockDirectory, mockCommand);

      expect(mockSpawn).toHaveBeenCalledWith(
        'npm',
        ['install'],
        expect.objectContaining({
          env: expect.objectContaining({ INIT_CWD: mockResolvedPath }),
        })
      );
    });

    it('should use npx -p @hubspot/cli when HUBSPOT_MCP_STANDALONE is true', async () => {
      const originalEnv = process.env.HUBSPOT_MCP_STANDALONE;
      process.env.HUBSPOT_MCP_STANDALONE = 'true';

      mockExistsSync.mockReturnValue(true);
      createMockProcess('success');

      await runCommandInDir(
        mockDirectory,
        new HubSpotCommand('project upload')
      );

      expect(mockSpawn).toHaveBeenCalledWith(
        'npx',
        [
          '-y',
          '-p',
          '@hubspot/cli',
          'hs',
          'project',
          'upload',
          '--disable-usage-tracking',
          'true',
        ],
        expect.any(Object)
      );

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

      mockExistsSync.mockReturnValue(true);
      createMockProcess('success');

      await runCommandInDir(
        mockDirectory,
        new HubSpotCommand('project upload')
      );

      expect(mockSpawn).toHaveBeenCalledWith(
        'npx',
        [
          '-y',
          '-p',
          '@hubspot/cli@8.1.0',
          'hs',
          'project',
          'upload',
          '--disable-usage-tracking',
          'true',
        ],
        expect.any(Object)
      );

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

    it('should propagate spawn errors via the error event', async () => {
      mockExistsSync.mockReturnValue(true);
      const spawnError = new Error('spawn ENOENT');
      createMockProcess('', '', 0, spawnError);

      await expect(runCommandInDir(mockDirectory, mockCommand)).rejects.toThrow(
        'spawn ENOENT'
      );
    });

    it('should reject with stdout and stderr attached on non-zero exit', async () => {
      mockExistsSync.mockReturnValue(true);
      createMockProcess('some output', 'some error', 1);

      await expect(
        runCommandInDir(mockDirectory, mockCommand)
      ).rejects.toMatchObject({
        code: 1,
        stdout: 'some output',
        stderr: 'some error',
      });
    });

    it('should return accumulated stdout and stderr in result', async () => {
      mockExistsSync.mockReturnValue(true);
      createMockProcess('hello stdout', 'hello stderr');

      const result = await runCommandInDir(mockDirectory, mockCommand);

      expect(result.stdout).toBe('hello stdout');
      expect(result.stderr).toBe('hello stderr');
    });

    it('should call onData callback with streaming chunks', async () => {
      mockExistsSync.mockReturnValue(true);
      createMockProcess('chunk output', 'chunk error');

      const onData = vi.fn();
      await runCommandInDir(mockDirectory, mockCommand, onData);

      expect(onData).toHaveBeenCalledWith('chunk output', 'stdout');
      expect(onData).toHaveBeenCalledWith('chunk error', 'stderr');
    });
  });
});
