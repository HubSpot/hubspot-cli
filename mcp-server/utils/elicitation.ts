import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  ElicitRequestFormParams,
  ElicitResult,
  PrimitiveSchemaDefinition,
} from '@modelcontextprotocol/sdk/types.js';
import { McpLogger } from './logger.js';
import { MCP_ELICITATION_TIMEOUT } from '../../lib/constants.js';

export function enumField(
  title: string,
  description: string,
  values: string[],
  names?: string[]
): PrimitiveSchemaDefinition {
  return { type: 'string', title, description, enum: values, enumNames: names };
}

export function booleanField(
  title: string,
  description: string,
  defaultValue?: boolean
): PrimitiveSchemaDefinition {
  return { type: 'boolean', title, description, default: defaultValue };
}

export function canElicit(mcpServer: McpServer): boolean {
  return Boolean(mcpServer.server.getClientCapabilities()?.elicitation?.form);
}

// Sends a JSON Schema of the required inputs to the client, pauses the tool
// call, and resumes when the client returns a response that matches the schema.
// The client collects the values from the user. The SDK checks the returned
// content against the schema before it resolves.
//
// Returns the SDK ElicitResult, or `undefined` when the client cannot elicit
// (it did not advertise form elicitation, or the request failed). Callers treat
// `undefined` and any non-`accept` action as "no answer" and fall back to text.
export async function requestElicitation(
  mcpServer: McpServer,
  params: {
    message: string;
    fields: Record<string, PrimitiveSchemaDefinition>;
    required?: string[];
  },
  logger?: McpLogger
): Promise<ElicitResult | undefined> {
  if (!canElicit(mcpServer)) {
    return undefined;
  }

  const requestedSchema: ElicitRequestFormParams['requestedSchema'] = {
    type: 'object',
    properties: params.fields,
    required: params.required,
  };

  try {
    return await mcpServer.server.elicitInput(
      { message: params.message, requestedSchema },
      { timeout: MCP_ELICITATION_TIMEOUT }
    );
  } catch (error) {
    logger?.warn('elicitation', {
      message: 'Elicitation request failed',
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}
