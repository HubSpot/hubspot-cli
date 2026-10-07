import { z } from 'zod';

const ValidationIssueSchema = z.object({
  message: z.string(),
  file: z.string().optional(),
  profile: z.string().optional(),
});

const ProfileValidationSchema = z.object({
  name: z.string(),
  accountId: z.number().optional(),
  valid: z.boolean(),
});

export const ProjectValidateSchema = z.object({
  valid: z.boolean(),
  projectName: z.string().optional(),
  platformVersion: z.string().optional(),
  profile: z.string().optional(),
  errors: z.array(ValidationIssueSchema),
  warnings: z.array(ValidationIssueSchema),
  profiles: z.array(ProfileValidationSchema).optional(),
});

export type ValidationIssueJsonOutput = z.infer<typeof ValidationIssueSchema>;
export type ProfileValidationJsonOutput = z.infer<
  typeof ProfileValidationSchema
>;
export type ProjectValidateJsonOutput = z.infer<typeof ProjectValidateSchema>;
