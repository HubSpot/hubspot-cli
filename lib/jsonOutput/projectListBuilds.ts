import { z } from 'zod';
import { Build } from '@hubspot/local-dev-lib/types/Build';

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

export const ProjectListBuildsSchema = z.object({
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

export type BuildSubbuildStatusJsonOutput = z.infer<
  typeof BuildSubbuildStatusSchema
>;
export type BuildJsonOutput = z.infer<typeof BuildSchema>;
export type ProjectListBuildsJsonOutput = z.infer<
  typeof ProjectListBuildsSchema
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
