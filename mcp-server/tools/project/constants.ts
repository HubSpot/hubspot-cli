import z from 'zod';

export const absoluteProjectPath = z
  .string()
  .describe('The absolute path to the project directory.');

export const absoluteCurrentWorkingDirectory = z
  .string()
  .describe('The absolute path to the current working directory.');

export const features = z
  .array(
    z.union([
      z.literal('card'),
      z.literal('settings'),
      z
        .literal('app-function')
        .describe('Also known as a public serverless function'),
      z.literal('webhooks'),
      z
        .literal('workflow-action')
        .describe('Also known as a custom workflow action.'),
      z.literal('workflow-action-tool').describe('Also known as agent tools.'),
      z.literal('app-object'),
      z.literal('app-event'),
      z.literal('scim'),
      z.literal('page'),
    ])
  )
  .describe(
    'The features to include in the project, multiple options can be selected'
  )
  .optional();

export const docsSearchQuery = z
  .string()
  .describe('The query to search the HubSpot Developer Documentation for.');

export const docUrl = z
  .string()
  .describe('The URL of the HubSpot Developer Documentation to fetch.');
