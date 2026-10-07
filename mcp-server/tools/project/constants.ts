import z from 'zod';

export const absoluteProjectPath = z
  .string()
  .describe('The absolute path to the project directory.');

export const absoluteCurrentWorkingDirectory = z
  .string()
  .describe('The absolute path to the current working directory.');

export const account = z
  .string()
  .optional()
  .describe(
    'Optional: the HubSpot account ID or name to use. If omitted and several accounts are available, you will be asked to choose.'
  );

export const confirmProductionAccount = z
  .optional(z.boolean())
  .describe(
    'Set to true only after this tool names a production account and the user then explicitly confirms that account in the conversation. NEVER set this on your own. The tool ignores this value when the client can show a confirmation form.'
  );

export const features = z
  .array(
    z.enum([
      'card',
      'settings',
      'app-function',
      'app-function-endpoint',
      'webhooks',
      'workflow-action',
      'workflow-action-tool',
      'app-object',
      'app-event',
      'scim',
      'page',
      'crm-bulk-action',
    ])
  )
  .describe(
    'The features to include in the project, multiple options can be selected. These are features of a developer-platform app, not CMS website assets. "app-function" is a private serverless function that runs inside the app and is not publicly accessible. It is distinct from a CMS serverless function, which is created with create-cms-function. "app-function-endpoint" is an app serverless function that is publicly accessible via an endpoint. "workflow-action" is also known as a custom workflow action. "workflow-action-tool" is also known as agent tools. "crm-bulk-action" is an app actions extension that lets users act on multiple CRM records at once.'
  )
  .optional();

export const docsSearchQuery = z
  .string()
  .describe('The query to search the HubSpot Developer Documentation for.');

export const docUrl = z
  .string()
  .describe('The URL of the HubSpot Developer Documentation to fetch.');

export const knowledgeSearchQuery = z
  .string()
  .describe(
    'The question to search the general HubSpot Knowledge Base for. Use natural language, for example "how do I set up a workflow" or "what is included in the Marketing Hub Professional plan".'
  );
