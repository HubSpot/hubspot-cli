import { z } from 'zod';
import { Build } from '@hubspot/local-dev-lib/types/Build';
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

const BuildSubbuildStatusSchema = z.object({
  buildName: z.string(),
  buildType: z.string(),
  status: z.string(),
  errorMessage: z.string().optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  rootPath: z.string().optional(),
  id: z.string().optional(),
  visible: z.boolean().optional(),
});

export const BuildSchema = z.object({
  buildId: z.number(),
  status: z.string(),
  isDeployed: z.boolean(),
  isAutoDeployEnabled: z.boolean().optional(),
  deployableState: z.string().optional(),
  platformVersion: z.string().optional(),
  uploadMessage: z.string().optional(),
  enqueuedAt: z.string().optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  createdAt: z.string().optional(),
  subbuildStatuses: z.array(BuildSubbuildStatusSchema),
});

export const ProjectBuildsListSchema = z.object({
  projectName: z.string(),
  deployedBuildId: z.number().optional(),
  results: z.array(BuildSchema),
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
export type BuildSubbuildStatusJsonOutput = z.infer<
  typeof BuildSubbuildStatusSchema
>;
export type BuildJsonOutput = z.infer<typeof BuildSchema>;
export type ProjectBuildsListJsonOutput = z.infer<
  typeof ProjectBuildsListSchema
>;
export type ProjectInfoJsonOutput = z.infer<typeof ProjectInfoSchema>;
export type PreviewJsonOutput = z.infer<typeof PreviewSchema>;
export type UploadJsonOutput = z.infer<typeof UploadSchema>;
export type DeployJsonOutput = z.infer<typeof DeploySchema>;
export type InstallStatusJsonOutput = z.infer<typeof InstallStatusSchema>;
export type InstallAppJsonOutput = z.infer<typeof InstallAppSchema>;
export type CreateTestAccountJsonOutput = z.infer<
  typeof CreateTestAccountSchema
>;

export function mapBuildToJsonOutput(
  build: Build,
  deployedBuildId?: number
): BuildJsonOutput {
  const {
    buildId,
    status,
    isAutoDeployEnabled,
    deployableState,
    platformVersion,
    uploadMessage,
    enqueuedAt,
    startedAt,
    finishedAt,
    createdAt,
    subbuildStatuses,
  } = build;

  return {
    buildId,
    status,
    isDeployed: buildId === deployedBuildId,
    isAutoDeployEnabled,
    deployableState,
    platformVersion,
    uploadMessage,
    enqueuedAt,
    startedAt,
    finishedAt,
    createdAt,
    subbuildStatuses: subbuildStatuses.map(subbuild => ({
      buildName: subbuild.buildName,
      buildType: subbuild.buildType,
      status: subbuild.status,
      errorMessage: subbuild.errorMessage,
      startedAt: subbuild.startedAt,
      finishedAt: subbuild.finishedAt,
      rootPath: subbuild.rootPath,
      id: subbuild.id,
      visible: subbuild.visible,
    })),
  };
}

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
