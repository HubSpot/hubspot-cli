import { z } from 'zod';

export const ProjectDownloadSchema = z.object({
  projectName: z.string(),
  buildId: z.number(),
  dest: z.string(),
  archiveDest: z.string().optional(),
});

export type ProjectDownloadJsonOutput = z.infer<typeof ProjectDownloadSchema>;
