import { z } from 'zod';

export const DownloadSchema = z.object({
  projectName: z.string(),
  buildId: z.number(),
  dest: z.string(),
});

export type DownloadJsonOutput = z.infer<typeof DownloadSchema>;
