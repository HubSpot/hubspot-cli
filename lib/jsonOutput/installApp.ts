import { z } from 'zod';

export const InstallAppSchema = z.object({
  appId: z.number(),
  appUid: z.string(),
  accountId: z.number(),
  projectId: z.number(),
  installationState: z.string(),
  installed: z.boolean(),
  reinstalled: z.boolean(),
});

export type InstallAppJsonOutput = z.infer<typeof InstallAppSchema>;
