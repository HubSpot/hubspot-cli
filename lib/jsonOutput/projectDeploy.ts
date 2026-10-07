import { z } from 'zod';

export const ProjectDeploySchema = z.object({
  deployId: z.number().optional(),
});

export type ProjectDeployJsonOutput = z.infer<typeof ProjectDeploySchema>;
