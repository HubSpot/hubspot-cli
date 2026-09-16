import { z } from 'zod';

export const DeploySchema = z.object({
  deployId: z.number().optional(),
});

export type DeployJsonOutput = z.infer<typeof DeploySchema>;
