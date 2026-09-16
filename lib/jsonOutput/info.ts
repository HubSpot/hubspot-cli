import { z } from 'zod';

export const ProjectInfoSchema = z.object({
  projectName: z.string(),
  platformVersion: z.string(),
  projectId: z.number(),
  deployedBuildId: z.number(),
  autoDeployEnabled: z.boolean(),
  projectUrl: z.string().optional(),
  app: z
    .object({
      name: z.string(),
      id: z.number(),
      uid: z.string(),
      authType: z.string().optional(),
      distributionType: z.string().optional(),
    })
    .optional(),
  components: z.array(z.object({ uid: z.string(), type: z.string() })),
});

export type ProjectInfoJsonOutput = z.infer<typeof ProjectInfoSchema>;
