import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpLogger } from './logger.js';
import { enumField, requestElicitation } from './elicitation.js';

export type SelectionOption = { value: string; label: string };

// Asks the client to pick one option from a runtime-discovered list. Returns
// the chosen value, or undefined when the list is empty, the client cannot
// elicit, or the user declines. When exactly one option exists it is returned
// without prompting.
export async function elicitSelection(
  mcpServer: McpServer,
  logger: McpLogger,
  params: {
    message: string;
    title: string;
    options: SelectionOption[];
  }
): Promise<string | undefined> {
  if (params.options.length === 0) {
    return undefined;
  }
  if (params.options.length === 1) {
    return params.options[0].value;
  }

  const elicitation = await requestElicitation(
    mcpServer,
    {
      message: params.message,
      fields: {
        selection: enumField(
          params.title,
          params.message,
          params.options.map(option => option.value),
          params.options.map(option => option.label)
        ),
      },
      required: ['selection'],
    },
    logger
  );

  if (
    elicitation?.action === 'accept' &&
    typeof elicitation.content?.selection === 'string'
  ) {
    return elicitation.content.selection;
  }

  return undefined;
}
