import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTemplatePrompt } from '../createTemplatePrompt.js';
import { promptUser } from '../promptUtils.js';

vi.mock('../promptUtils.js');

const mockPromptUser = vi.mocked(promptUser);

describe('createTemplatePrompt', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('when templateType is provided', () => {
    it('should return provided templateType without prompting', async () => {
      const commandArgs = {
        templateType: 'page-template' as const,
      };

      const result = await createTemplatePrompt(commandArgs);

      expect(mockPromptUser).not.toHaveBeenCalled();
      expect(result).toEqual({
        templateType: 'page-template',
      });
    });

    it('should work with different template types', async () => {
      const testCases = [
        'email-template',
        'partial',
        'global-partial',
        'blog-listing-template',
        'blog-post-template',
        'search-template',
        'section',
      ] as const;

      for (const templateType of testCases) {
        const commandArgs = { templateType };
        const result = await createTemplatePrompt(commandArgs);

        expect(mockPromptUser).not.toHaveBeenCalled();
        expect(result).toEqual({ templateType });

        vi.resetAllMocks();
      }
    });
  });

  describe('when templateType is not provided', () => {
    it('should prompt for templateType', async () => {
      mockPromptUser.mockResolvedValue({
        templateType: 'page-template',
      });

      const result = await createTemplatePrompt();

      expect(mockPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'templateType',
          type: 'list',
          choices: expect.any(Array),
        }),
      ]);
      expect(result).toEqual({
        templateType: 'page-template',
      });
    });

    it('should prompt when commandArgs is empty', async () => {
      mockPromptUser.mockResolvedValue({
        templateType: 'email-template',
      });

      const result = await createTemplatePrompt({});

      expect(mockPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'templateType' }),
      ]);
      expect(result).toEqual({
        templateType: 'email-template',
      });
    });

    it('should prompt when templateType is undefined', async () => {
      const commandArgs = {
        templateType: undefined,
      };

      mockPromptUser.mockResolvedValue({
        templateType: 'partial',
      });

      const result = await createTemplatePrompt(commandArgs);

      expect(mockPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'templateType' }),
      ]);
      expect(result).toEqual({
        templateType: 'partial',
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle mixed usage patterns', async () => {
      // First call with templateType provided
      let result = await createTemplatePrompt({
        templateType: 'blog-post-template' as const,
      });
      expect(result.templateType).toBe('blog-post-template');
      expect(mockPromptUser).not.toHaveBeenCalled();

      // Second call without templateType
      mockPromptUser.mockResolvedValue({
        templateType: 'section',
      });

      result = await createTemplatePrompt();
      expect(result.templateType).toBe('section');
      expect(mockPromptUser).toHaveBeenCalledTimes(1);
    });
  });
});
