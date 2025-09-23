import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFunctionPrompt } from '../createFunctionPrompt.js';
import { promptUser } from '../promptUtils.js';

vi.mock('../promptUtils.js');

const mockPromptUser = vi.mocked(promptUser);

describe('createFunctionPrompt', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('when all parameters are provided', () => {
    it('should return provided values without prompting', async () => {
      const commandArgs = {
        functionsFolder: 'my-functions',
        filename: 'my-function',
        endpointMethod: 'POST' as const,
        endpointPath: '/api/test',
      };

      const result = await createFunctionPrompt(commandArgs);

      expect(mockPromptUser).not.toHaveBeenCalled();
      expect(result).toEqual({
        functionsFolder: 'my-functions',
        filename: 'my-function',
        endpointMethod: 'POST',
        endpointPath: '/api/test',
      });
    });

    it('should use default GET method when endpointMethod not provided', async () => {
      const commandArgs = {
        functionsFolder: 'my-functions',
        filename: 'my-function',
        endpointPath: '/api/test',
      };

      const result = await createFunctionPrompt(commandArgs);

      expect(mockPromptUser).not.toHaveBeenCalled();
      expect(result).toEqual({
        functionsFolder: 'my-functions',
        filename: 'my-function',
        endpointMethod: 'GET',
        endpointPath: '/api/test',
      });
    });
  });

  describe('when some parameters are missing', () => {
    it('should only prompt for missing parameters', async () => {
      const commandArgs = {
        functionsFolder: 'my-functions',
        endpointMethod: 'POST' as const,
      };

      mockPromptUser.mockResolvedValue({
        filename: 'prompted-function',
        endpointPath: '/prompted-path',
      });

      const result = await createFunctionPrompt(commandArgs);

      expect(mockPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'filename' }),
        expect.objectContaining({ name: 'endpointPath' }),
      ]);
      expect(result).toEqual({
        functionsFolder: 'my-functions',
        filename: 'prompted-function',
        endpointMethod: 'POST',
        endpointPath: '/prompted-path',
      });
    });
  });

  describe('when no parameters are provided', () => {
    it('should prompt for all parameters', async () => {
      mockPromptUser.mockResolvedValue({
        functionsFolder: 'prompted-functions',
        filename: 'prompted-function',
        endpointMethod: 'GET',
        endpointPath: '/prompted-path',
      });

      const result = await createFunctionPrompt();

      expect(mockPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'functionsFolder' }),
        expect.objectContaining({ name: 'filename' }),
        expect.objectContaining({ name: 'endpointMethod' }),
        expect.objectContaining({ name: 'endpointPath' }),
      ]);
      expect(result).toEqual({
        functionsFolder: 'prompted-functions',
        filename: 'prompted-function',
        endpointMethod: 'GET',
        endpointPath: '/prompted-path',
      });
    });
  });

  describe('parameter precedence', () => {
    it('should prioritize command args over prompted values', async () => {
      const commandArgs = {
        functionsFolder: 'arg-functions',
      };

      mockPromptUser.mockResolvedValue({
        filename: 'prompted-function',
        endpointMethod: 'POST',
        endpointPath: '/prompted-path',
      });

      const result = await createFunctionPrompt(commandArgs);

      expect(result).toEqual({
        functionsFolder: 'arg-functions', // from commandArgs
        filename: 'prompted-function', // from prompt
        endpointMethod: 'POST', // from prompt
        endpointPath: '/prompted-path', // from prompt
      });
    });

    it('should handle mixed scenario with partial command args and prompting', async () => {
      const commandArgs = {
        functionsFolder: 'my-funcs',
        endpointMethod: 'DELETE' as const,
      };

      mockPromptUser.mockResolvedValue({
        filename: 'delete-handler',
        endpointPath: '/api/delete',
      });

      const result = await createFunctionPrompt(commandArgs);

      expect(mockPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'filename' }),
        expect.objectContaining({ name: 'endpointPath' }),
      ]);

      expect(result).toEqual({
        functionsFolder: 'my-funcs', // from commandArgs
        filename: 'delete-handler', // from prompt
        endpointMethod: 'DELETE', // from commandArgs
        endpointPath: '/api/delete', // from prompt
      });
    });
  });
});
