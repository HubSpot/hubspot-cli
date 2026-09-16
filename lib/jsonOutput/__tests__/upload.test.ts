import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { mapAccountToTargetAccount, UploadSchema } from '../upload.js';

describe('lib/jsonOutput/upload', () => {
  describe('mapAccountToTargetAccount()', () => {
    it('should map account name and type when present', () => {
      const account = {
        accountId: 12345678,
        name: 'My Test Portal',
        accountType: 'STANDARD',
        env: 'prod',
        authType: 'personalaccesskey',
      } as unknown as HubSpotConfigAccount;

      expect(mapAccountToTargetAccount(12345678, account)).toEqual({
        accountId: 12345678,
        accountName: 'My Test Portal',
        accountType: 'STANDARD',
      });
    });

    it('should return only the accountId when no account config is found', () => {
      expect(mapAccountToTargetAccount(12345678, undefined)).toEqual({
        accountId: 12345678,
      });
      expect(mapAccountToTargetAccount(12345678, null)).toEqual({
        accountId: 12345678,
      });
    });

    it('should leave optional fields undefined when the account has no name', () => {
      const account = {
        accountId: 12345678,
        accountType: 'SANDBOX',
      } as unknown as HubSpotConfigAccount;

      const result = mapAccountToTargetAccount(12345678, account);

      expect(result).toEqual({
        accountId: 12345678,
        accountName: undefined,
        accountType: 'SANDBOX',
      });
    });

    it('should produce output that satisfies UploadSchema as a targetAccount', () => {
      const account = {
        accountId: 12345678,
        name: 'My Test Portal',
        accountType: 'STANDARD',
      } as unknown as HubSpotConfigAccount;

      const targetAccount = mapAccountToTargetAccount(12345678, account);

      expect(UploadSchema.safeParse({ targetAccount }).success).toBe(true);
    });
  });

  describe('UploadSchema', () => {
    it.each([
      [
        'direct CLI success',
        {
          targetAccount: {
            accountId: 12345678,
            accountName: 'My Test Portal',
            accountType: 'STANDARD',
          },
          buildId: 123,
          deployId: 456,
        },
      ],
      [
        'success with preview',
        {
          targetAccount: {
            accountId: 12345678,
            accountName: 'My Test Portal',
            accountType: 'DEVELOPER_TEST',
          },
          buildId: 124,
          preview: { releaseTag: 'preview-abc123', succeeded: true },
        },
      ],
    ])('should validate representative %s output', (_label, output) => {
      expect(UploadSchema.safeParse(output).success).toBe(true);
    });

    it('should accept a minimal success output with only a buildId', () => {
      expect(UploadSchema.safeParse({ buildId: 5 }).success).toBe(true);
    });

    it('should reject a targetAccount without an accountId', () => {
      expect(
        UploadSchema.safeParse({ targetAccount: { accountName: 'x' } }).success
      ).toBe(false);
    });
  });
});
