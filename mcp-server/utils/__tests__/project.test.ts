import { runCommandInDir, CommandResults } from '../project.js';
import { execAsync } from '../command.js';
import fs from 'fs';
import path from 'path';
import { MockedFunction } from 'vitest';

vi.mock('../command');
vi.mock('fs');
vi.mock('path');

const mockExecAsync = execAsync as unknown as MockedFunction<typeof execAsync>;
const mockExistsSync = fs.existsSync as MockedFunction<typeof fs.existsSync>;
const mockMkdirSync = fs.mkdirSync as MockedFunction<typeof fs.mkdirSync>;
const mockResolve = path.resolve as MockedFunction<typeof path.resolve>;

describe('mcp-server/utils/project', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });
});
