import { z } from 'zod';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';

const PreviewSchema = z.object({
  releaseTag: z.string().optional(),
  succeeded: z.boolean(),
});

const TargetAccountSchema = z.object({
  accountId: z.number(),
  accountName: z.string().optional(),
  accountType: z.string().optional(),
});

export const ProjectUploadSchema = z.object({
  targetAccount: TargetAccountSchema.optional(),
  buildId: z.number().optional(),
  deployId: z.number().optional(),
  preview: PreviewSchema.optional(),
});

export type PreviewJsonOutput = z.infer<typeof PreviewSchema>;
export type TargetAccountJsonOutput = z.infer<typeof TargetAccountSchema>;
export type ProjectUploadJsonOutput = z.infer<typeof ProjectUploadSchema>;

export function mapAccountToTargetAccount(
  accountId: number,
  account?: HubSpotConfigAccount | null
): TargetAccountJsonOutput {
  return {
    accountId,
    accountName: account?.name,
    accountType: account?.accountType,
  };
}
