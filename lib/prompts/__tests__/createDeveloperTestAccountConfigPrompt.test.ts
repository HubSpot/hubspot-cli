import { describe, it, expect, vi } from 'vitest';
import { createDeveloperTestAccountConfigPrompt } from '../createDeveloperTestAccountConfigPrompt.js';
import * as promptUtils from '../promptUtils.js';

vi.mock('../promptUtils.js');

describe('createDeveloperTestAccountConfigPrompt', () => {
  describe('with name and description provided via args', () => {
    it('should skip name and description prompts when provided', async () => {
      const mockPromptUser = vi.mocked(promptUtils.promptUser);
      mockPromptUser.mockResolvedValueOnce({}); // name/description prompts skipped
      mockPromptUser.mockResolvedValueOnce({
        useDefaultAccountLevels: 'default',
      }); // tier selection

      const result = await createDeveloperTestAccountConfigPrompt({
        name: 'TestAccount',
        description: 'Test description',
      });

      expect(result).toEqual({
        accountName: 'TestAccount',
        description: 'Test description',
        marketingLevel: 'ENTERPRISE',
        opsLevel: 'ENTERPRISE',
        serviceLevel: 'ENTERPRISE',
        salesLevel: 'ENTERPRISE',
        contentLevel: 'ENTERPRISE',
        commerceLevel: 'ENTERPRISE',
      });

      expect(mockPromptUser).toHaveBeenCalledTimes(2);
    });
  });

  describe('with tier flags provided', () => {
    it('should skip tier prompts and use provided values with defaults', async () => {
      const mockPromptUser = vi.mocked(promptUtils.promptUser);
      mockPromptUser.mockResolvedValueOnce({}); // name/description prompts skipped

      const result = await createDeveloperTestAccountConfigPrompt({
        name: 'TestAccount',
        description: 'Test',
        marketingLevel: 'PROFESSIONAL',
        salesLevel: 'STARTER',
      });

      expect(result).toEqual({
        accountName: 'TestAccount',
        description: 'Test',
        marketingLevel: 'PROFESSIONAL',
        opsLevel: 'ENTERPRISE',
        serviceLevel: 'ENTERPRISE',
        salesLevel: 'STARTER',
        contentLevel: 'ENTERPRISE',
        commerceLevel: 'ENTERPRISE',
      });

      // Should only call promptUser once (for name/description which are skipped)
      expect(mockPromptUser).toHaveBeenCalledTimes(1);
    });

    it('should default unprovided tiers to ENTERPRISE', async () => {
      const mockPromptUser = vi.mocked(promptUtils.promptUser);
      mockPromptUser.mockResolvedValueOnce({
        description: 'Test',
      }); // description prompt (name provided via args, description not provided)

      const result = await createDeveloperTestAccountConfigPrompt({
        name: 'TestAccount',
        contentLevel: 'FREE',
      });

      expect(result).toEqual({
        accountName: 'TestAccount',
        description: 'Test',
        marketingLevel: 'ENTERPRISE',
        opsLevel: 'ENTERPRISE',
        serviceLevel: 'ENTERPRISE',
        salesLevel: 'ENTERPRISE',
        contentLevel: 'FREE',
        commerceLevel: 'ENTERPRISE',
      });
    });
  });

  describe('with no flags provided', () => {
    it('should prompt for name, description, and tier selection', async () => {
      const mockPromptUser = vi.mocked(promptUtils.promptUser);
      // First call: name/description prompts
      mockPromptUser.mockResolvedValueOnce({
        accountName: 'PromptedAccount',
        description: 'Prompted description',
      });
      // Second call: tier selection
      mockPromptUser.mockResolvedValueOnce({
        useDefaultAccountLevels: 'default',
      });

      const result = await createDeveloperTestAccountConfigPrompt({});

      expect(result).toEqual({
        accountName: 'PromptedAccount',
        description: 'Prompted description',
        marketingLevel: 'ENTERPRISE',
        opsLevel: 'ENTERPRISE',
        serviceLevel: 'ENTERPRISE',
        salesLevel: 'ENTERPRISE',
        contentLevel: 'ENTERPRISE',
        commerceLevel: 'ENTERPRISE',
      });

      expect(mockPromptUser).toHaveBeenCalledTimes(2);
    });

    it('should allow manual tier selection', async () => {
      const mockPromptUser = vi.mocked(promptUtils.promptUser);
      mockPromptUser.mockResolvedValueOnce({
        accountName: 'TestAccount',
        description: 'Test',
      }); // name/description
      mockPromptUser.mockResolvedValueOnce({
        useDefaultAccountLevels: 'manual',
      }); // tier choice
      mockPromptUser.mockResolvedValueOnce({
        testAccountLevels: [
          { hub: 'MARKETING', tier: 'PROFESSIONAL' },
          { hub: 'OPS', tier: 'STARTER' },
          { hub: 'SERVICE', tier: 'ENTERPRISE' },
          { hub: 'SALES', tier: 'FREE' },
          { hub: 'CONTENT', tier: 'ENTERPRISE' },
          { hub: 'COMMERCE', tier: 'STARTER' },
        ],
      }); // manual tier selection

      const result = await createDeveloperTestAccountConfigPrompt({});

      expect(result).toEqual({
        accountName: 'TestAccount',
        description: 'Test',
        marketingLevel: 'PROFESSIONAL',
        opsLevel: 'STARTER',
        serviceLevel: 'ENTERPRISE',
        salesLevel: 'FREE',
        contentLevel: 'ENTERPRISE',
        commerceLevel: 'STARTER',
      });

      expect(mockPromptUser).toHaveBeenCalledTimes(3);
    });
  });

  describe('with only name provided', () => {
    it('should skip name prompt but show description and tier prompts', async () => {
      const mockPromptUser = vi.mocked(promptUtils.promptUser);
      mockPromptUser.mockResolvedValueOnce({
        description: 'Prompted description',
      }); // description prompt (name skipped)
      mockPromptUser.mockResolvedValueOnce({
        useDefaultAccountLevels: 'default',
      }); // tier selection

      const result = await createDeveloperTestAccountConfigPrompt({
        name: 'TestAccount',
      });

      expect(result).toEqual({
        accountName: 'TestAccount',
        description: 'Prompted description',
        marketingLevel: 'ENTERPRISE',
        opsLevel: 'ENTERPRISE',
        serviceLevel: 'ENTERPRISE',
        salesLevel: 'ENTERPRISE',
        contentLevel: 'ENTERPRISE',
        commerceLevel: 'ENTERPRISE',
      });

      expect(mockPromptUser).toHaveBeenCalledTimes(2);
    });
  });
});
