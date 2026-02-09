import { runCommandInDir, CommandResults } from '../project.js';
import { execAsync } from '../command.js';
import fs from 'fs';
import path from 'path';
import { MockedFunction } from 'vitest';

vi.mock('../command', () => ({
  execAsync: vi.fn(),
  addFlag: vi.fn(
    (
      command: string,
      flagName: string,
      value: string | number | boolean | string[]
    ) => {
      if (Array.isArray(value)) {
        return `${command} --${flagName} ${value.map(item => `"${item}"`).join(' ')}`;
      }
      return `${command} --${flagName} "${value}"`;
    }
  ),
}));
vi.mock('fs');
vi.mock('path');

const mockExecAsync = execAsync as unknown as MockedFunction<typeof execAsync>;
const mockExistsSync = fs.existsSync as MockedFunction<typeof fs.existsSync>;
const mockMkdirSync = fs.mkdirSync as MockedFunction<typeof fs.mkdirSync>;
const mockResolve = path.resolve as MockedFunction<typeof path.resolve>;

describe('mcp-server/utils/project', () => {
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
  });
});
