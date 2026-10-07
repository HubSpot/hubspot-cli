import { z } from 'zod';

export const ProjectDownloadSchema = z.object({
  projectName: z.string(),
  buildId: z.number(),
  dest: z.string(),
});

export type ProjectDownloadJsonOutput = z.infer<typeof ProjectDownloadSchema>;
