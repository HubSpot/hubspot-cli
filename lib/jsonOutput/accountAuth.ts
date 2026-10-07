import { z } from 'zod';

export const AccountAuthSchema = z.object({
  accountId: z.number(),
  accountName: z.string().optional(),
  authType: z.string().optional(),
});

export type AccountAuthJsonOutput = z.infer<typeof AccountAuthSchema>;
