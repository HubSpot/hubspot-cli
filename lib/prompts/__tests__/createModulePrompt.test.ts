import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createModulePrompt } from '../createModulePrompt.js';
import { promptUser } from '../promptUtils.js';

vi.mock('../promptUtils.js');

const mockPromptUser = vi.mocked(promptUser);

describe('createModulePrompt', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('when all parameters are provided', () => {
    it('should return provided values without prompting', async () => {
      const commandArgs = {
        moduleLabel: 'My Module',
        reactType: true,
        contentTypes: 'LANDING_PAGE,SITE_PAGE',
        global: false,
        availableForNewContent: true,
      };

      const result = await createModulePrompt(commandArgs);

      expect(mockPromptUser).not.toHaveBeenCalled();
      expect(result).toEqual({
        moduleLabel: 'My Module',
        reactType: true,
        contentTypes: ['LANDING_PAGE', 'SITE_PAGE'],
        global: false,
        availableForNewContent: true,
      });
    });

    it('should use default values when optional parameters not provided', async () => {
      const commandArgs = {
        moduleLabel: 'My Module',
      };

      mockPromptUser.mockResolvedValue({
        reactType: false,
        contentTypes: ['ANY'],
        global: false,
        availableForNewContent: true,
      });

      const result = await createModulePrompt(commandArgs);

      expect(mockPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'reactType' }),
        expect.objectContaining({ name: 'contentTypes' }),
        expect.objectContaining({ name: 'global' }),
        expect.objectContaining({ name: 'availableForNewContent' }),
      ]);
      expect(result).toEqual({
        moduleLabel: 'My Module',
        reactType: false,
        contentTypes: ['ANY'],
        global: false,
        availableForNewContent: true,
      });
    });

    it('should parse contentTypes string correctly', async () => {
      const commandArgs = {
        moduleLabel: 'Test Module',
        contentTypes: 'BLOG_POST, EMAIL, LANDING_PAGE',
      };

      mockPromptUser.mockResolvedValue({
        reactType: false,
        global: false,
        availableForNewContent: true,
      });

      const result = await createModulePrompt(commandArgs);

      expect(result.contentTypes).toEqual([
        'BLOG_POST',
        'EMAIL',
        'LANDING_PAGE',
      ]);
    });
  });

  describe('when some parameters are missing', () => {
    it('should only prompt for missing parameters', async () => {
      const commandArgs = {
        moduleLabel: 'My Module',
        reactType: true,
      };

      mockPromptUser.mockResolvedValue({
        contentTypes: ['SITE_PAGE'],
        global: true,
        availableForNewContent: false,
      });

      const result = await createModulePrompt(commandArgs);

      expect(mockPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'contentTypes' }),
        expect.objectContaining({ name: 'global' }),
        expect.objectContaining({ name: 'availableForNewContent' }),
      ]);
      expect(result).toEqual({
        moduleLabel: 'My Module',
        reactType: true,
        contentTypes: ['SITE_PAGE'],
        global: true,
        availableForNewContent: false,
      });
    });
  });

  describe('when no parameters are provided', () => {
    it('should prompt for all parameters', async () => {
      mockPromptUser.mockResolvedValue({
        moduleLabel: 'Prompted Module',
        reactType: false,
        contentTypes: ['ANY'],
        global: false,
        availableForNewContent: true,
      });

      const result = await createModulePrompt();

      expect(mockPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'moduleLabel' }),
        expect.objectContaining({ name: 'reactType' }),
        expect.objectContaining({ name: 'contentTypes' }),
        expect.objectContaining({ name: 'global' }),
        expect.objectContaining({ name: 'availableForNewContent' }),
      ]);
      expect(result).toEqual({
        moduleLabel: 'Prompted Module',
        reactType: false,
        contentTypes: ['ANY'],
        global: false,
        availableForNewContent: true,
      });
    });
  });

  describe('parameter precedence', () => {
    it('should prioritize command args over prompted values', async () => {
      const commandArgs = {
        moduleLabel: 'Args Module',
        global: true,
      };

      mockPromptUser.mockResolvedValue({
        reactType: false,
        contentTypes: ['EMAIL'],
        availableForNewContent: false,
      });

      const result = await createModulePrompt(commandArgs);

      expect(result).toEqual({
        moduleLabel: 'Args Module', // from commandArgs
        reactType: false, // from prompt
        contentTypes: ['EMAIL'], // from prompt
        global: true, // from commandArgs
        availableForNewContent: false, // from prompt
      });
    });

    it('should handle boolean false values correctly', async () => {
      const commandArgs = {
        moduleLabel: 'Test Module',
        reactType: false,
        contentTypes: 'ANY',
        global: false,
        availableForNewContent: false,
      };

      const result = await createModulePrompt(commandArgs);

      expect(mockPromptUser).not.toHaveBeenCalled();
      expect(result).toEqual({
        moduleLabel: 'Test Module',
        reactType: false,
        contentTypes: ['ANY'],
        global: false,
        availableForNewContent: false,
      });
    });

    it('should handle mixed scenario with partial command args and prompting', async () => {
      const commandArgs = {
        moduleLabel: 'Partial Module',
        contentTypes: 'BLOG_POST,BLOG_LISTING',
      };

      mockPromptUser.mockResolvedValue({
        reactType: true,
        global: false,
        availableForNewContent: true,
      });

      const result = await createModulePrompt(commandArgs);

      expect(mockPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'reactType' }),
        expect.objectContaining({ name: 'global' }),
        expect.objectContaining({ name: 'availableForNewContent' }),
      ]);

      expect(result).toEqual({
        moduleLabel: 'Partial Module', // from commandArgs
        reactType: true, // from prompt
        contentTypes: ['BLOG_POST', 'BLOG_LISTING'], // from commandArgs (parsed)
        global: false, // from prompt
        availableForNewContent: true, // from prompt
      });
    });
  });
});
