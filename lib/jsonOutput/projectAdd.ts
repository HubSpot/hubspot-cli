import { z } from 'zod';

export const ProjectAddSchema = z.object({
  addedFeatures: z.array(z.string()).optional(),
  app: z
    .object({
      distribution: z.string(),
      auth: z.string(),
    })
    .optional(),
});

export type ProjectAddJsonOutput = z.infer<typeof ProjectAddSchema>;
