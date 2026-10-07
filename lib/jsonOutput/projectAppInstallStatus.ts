import { z } from 'zod';

const ScopeGroupSchema = z.object({
  id: z.number(),
  name: z.string(),
});

export const ProjectAppInstallStatusSchema = z.object({
  appId: z.number().optional(),
  appUid: z.string(),
  accountId: z.number(),
  projectId: z.number(),
  isInstalled: z.boolean(),
  isInstalledWithCurrentScopes: z.boolean(),
  previouslyAuthorizedScopeGroups: z.array(ScopeGroupSchema),
});

export type ProjectAppInstallStatusJsonOutput = z.infer<
  typeof ProjectAppInstallStatusSchema
>;
