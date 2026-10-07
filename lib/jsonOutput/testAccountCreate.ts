import { z } from 'zod';

export const TestAccountCreateSchema = z.object({
  accountName: z.string().optional(),
  accountId: z.number().optional(),
  personalAccessKey: z.string().optional(),
});

export type TestAccountCreateJsonOutput = z.infer<
  typeof TestAccountCreateSchema
>;
