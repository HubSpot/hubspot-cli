import { z } from 'zod';
import { Release } from '../api/releases.js';

const ReleaseComponentSchema = z.object({
  buildType: z.string(),
  buildName: z.string().optional(),
  rootPath: z.string().optional(),
  id: z.string().optional(),
});

export const ReleaseSchema = z.object({
  releaseTag: z.string(),
  buildId: z.number(),
  createdAt: z.string(),
  components: z.array(ReleaseComponentSchema).optional(),
});

export const ReleaseListSchema = z.object({
  results: z.array(ReleaseSchema),
  paging: z
    .object({
      next: z.object({
        after: z.string(),
      }),
    })
    .optional(),
});

export const ProjectInfoSchema = z.object({
  projectName: z.string(),
  platformVersion: z.string(),
  projectId: z.number(),
  deployedBuildId: z.number(),
  autoDeployEnabled: z.boolean(),
  projectUrl: z.string().optional(),
  app: z
    .object({
      name: z.string(),
      id: z.number(),
      uid: z.string(),
      authType: z.string().optional(),
      distributionType: z.string().optional(),
    })
    .optional(),
  components: z.array(z.object({ uid: z.string(), type: z.string() })),
});

const PreviewSchema = z.object({
  releaseTag: z.string().optional(),
  succeeded: z.boolean(),
});

export const UploadSchema = z.object({
  buildId: z.number().optional(),
  deployId: z.number().optional(),
  preview: PreviewSchema.optional(),
});

export const DeploySchema = z.object({
  deployId: z.number().optional(),
});

const ScopeGroupSchema = z.object({
  id: z.number(),
  name: z.string(),
});

export const InstallStatusSchema = z.object({
  appId: z.number().optional(),
  appUid: z.string(),
  accountId: z.number(),
  projectId: z.number(),
  isInstalled: z.boolean(),
  isInstalledWithCurrentScopes: z.boolean(),
  previouslyAuthorizedScopeGroups: z.array(ScopeGroupSchema),
});

export const InstallAppSchema = z.object({
  appId: z.number(),
  appUid: z.string(),
  accountId: z.number(),
  projectId: z.number(),
  installationState: z.string(),
  installed: z.boolean(),
  reinstalled: z.boolean(),
});

export const CreateTestAccountSchema = z.object({
  accountName: z.string().optional(),
  accountId: z.number().optional(),
  personalAccessKey: z.string().optional(),
});

export type ReleaseComponentJsonOutput = z.infer<typeof ReleaseComponentSchema>;
export type ReleaseJsonOutput = z.infer<typeof ReleaseSchema>;
export type ReleaseListJsonOutput = z.infer<typeof ReleaseListSchema>;
export type ProjectInfoJsonOutput = z.infer<typeof ProjectInfoSchema>;
export type PreviewJsonOutput = z.infer<typeof PreviewSchema>;
export type UploadJsonOutput = z.infer<typeof UploadSchema>;
export type DeployJsonOutput = z.infer<typeof DeploySchema>;
export type InstallStatusJsonOutput = z.infer<typeof InstallStatusSchema>;
export type InstallAppJsonOutput = z.infer<typeof InstallAppSchema>;
export type CreateTestAccountJsonOutput = z.infer<
  typeof CreateTestAccountSchema
>;

export function mapReleaseToJsonOutput(release: Release): ReleaseJsonOutput {
  const { releaseTag, buildId, createdAt, components } = release;
  return {
    releaseTag,
    buildId,
    createdAt,
    components: components?.map(({ buildType, buildName, rootPath, id }) => ({
      buildType,
      buildName,
      rootPath,
      id,
    })),
  };
}
