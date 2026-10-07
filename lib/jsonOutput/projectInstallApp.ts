import { z } from 'zod';

export const ProjectInstallAppSchema = z.object({
  appId: z.number(),
  appUid: z.string(),
  accountId: z.number(),
  projectId: z.number(),
  installationState: z.string(),
  installed: z.boolean(),
  reinstalled: z.boolean(),
});

export type ProjectInstallAppJsonOutput = z.infer<
  typeof ProjectInstallAppSchema
>;
