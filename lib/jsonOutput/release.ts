import { z } from 'zod';
import { Release } from '../../api/releases.js';

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

export type ReleaseComponentJsonOutput = z.infer<typeof ReleaseComponentSchema>;
export type ReleaseJsonOutput = z.infer<typeof ReleaseSchema>;
export type ReleaseListJsonOutput = z.infer<typeof ReleaseListSchema>;

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
