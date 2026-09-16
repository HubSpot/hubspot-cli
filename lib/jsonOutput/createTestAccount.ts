import { z } from 'zod';

export const CreateTestAccountSchema = z.object({
  accountName: z.string().optional(),
  accountId: z.number().optional(),
  personalAccessKey: z.string().optional(),
});

export type CreateTestAccountJsonOutput = z.infer<
  typeof CreateTestAccountSchema
>;
