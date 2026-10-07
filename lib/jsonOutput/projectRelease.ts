import { z } from 'zod';
import { CreatedRelease } from '../../api/releases.js';

const ReleaseComponentSchema = z.object({
  buildType: z.string(),
  buildName: z.string().optional(),
  rootPath: z.string().optional(),
  id: z.string().optional(),
});

export const ProjectReleaseSchema = z.object({
  // Optional: a global-only (standalone) build deploys tag-free, see CreatedRelease.
  releaseTag: z.string().optional(),
  buildId: z.number(),
  createdAt: z.string(),
  components: z.array(ReleaseComponentSchema).optional(),
});

export const ProjectReleasePreviewSchema = z.object({
  buildId: z.number(),
  targetPortalId: z.number(),
  releaseTag: z.string().optional(),
  succeeded: z.boolean(),
});

export const ProjectReleaseListSchema = z.object({
  results: z.array(ProjectReleaseSchema),
  paging: z
    .object({
      next: z.object({
        after: z.string(),
      }),
    })
    .optional(),
});

export type ReleaseComponentJsonOutput = z.infer<typeof ReleaseComponentSchema>;
export type ProjectReleaseJsonOutput = z.infer<typeof ProjectReleaseSchema>;
export type ProjectReleaseListJsonOutput = z.infer<
  typeof ProjectReleaseListSchema
>;
export type ProjectReleasePreviewJsonOutput = z.infer<
  typeof ProjectReleasePreviewSchema
>;

export function mapReleaseToJsonOutput(
  release: CreatedRelease
): ProjectReleaseJsonOutput {
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
