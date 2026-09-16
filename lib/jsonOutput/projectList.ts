import { z } from 'zod';
import { Project } from '@hubspot/local-dev-lib/types/Project';

const ProjectListItemSchema = z.object({
  name: z.string(),
  id: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
  platformVersion: z.string().optional(),
  latestBuildId: z.number().optional(),
  deployedBuildId: z.number().optional(),
  isLocked: z.boolean(),
});

export const ProjectListSchema = z.object({
  accountId: z.number(),
  results: z.array(ProjectListItemSchema),
});

export type ProjectListItemJsonOutput = z.infer<typeof ProjectListItemSchema>;
export type ProjectListJsonOutput = z.infer<typeof ProjectListSchema>;

export function mapProjectToListItem(
  project: Project
): ProjectListItemJsonOutput {
  const {
    name,
    id,
    createdAt,
    updatedAt,
    isLocked,
    latestBuild,
    deployedBuildId,
  } = project;
  return {
    name,
    id,
    createdAt,
    updatedAt,
    platformVersion: latestBuild?.platformVersion,
    latestBuildId: latestBuild?.buildId,
    deployedBuildId,
    isLocked,
  };
}
