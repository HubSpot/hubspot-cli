import { z } from 'zod';

export const ProjectCreateSchema = z.object({
  name: z.string().optional(),
  location: z.string().optional(),
  platformVersion: z.string().optional(),
  projectBase: z.string().optional(),
});

export type ProjectCreateJsonOutput = z.infer<typeof ProjectCreateSchema>;
