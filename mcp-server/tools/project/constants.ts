import z from 'zod';

export const absoluteProjectPath = z
  .string()
  .describe('The absolute path to the project directory.');

export const absoluteCurrentWorkingDirectory = z
  .string()
  .describe('The absolute path to the current working directory.');

export const features = z
  .array(
    z.enum([
      'card',
      'settings',
      'app-function',
      'webhooks',
      'workflow-action',
      'workflow-action-tool',
      'app-object',
      'app-event',
      'scim',
      'page',
    ])
  )
  .describe(
    'The features to include in the project, multiple options can be selected. "app-function" is also known as a public serverless function. "workflow-action" is also known as a custom workflow action. "workflow-action-tool" is also known as agent tools.'
  )
  .optional();

export const docsSearchQuery = z
  .string()
  .describe('The query to search the HubSpot Developer Documentation for.');

export const docUrl = z
  .string()
  .describe('The URL of the HubSpot Developer Documentation to fetch.');
