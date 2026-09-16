import { TextContent, McpToolResponse } from '../types.js';
import { mcpFeedbackRequest } from './feedbackTracking.js';

export async function formatTextContents(
  ...outputs: (string | undefined)[]
): Promise<McpToolResponse> {
  const content: TextContent[] = [];
  outputs.forEach(output => {
    if (output) {
      content.push(formatTextContent(output));
    }
  });

  if (outputs.length > 0) {
    const feedback = await mcpFeedbackRequest();
    if (feedback) {
      content.push(formatTextContent(feedback));
    }
  }
  return {
    content,
  };
}

export function formatTextContent(text: string): TextContent {
  return {
    type: 'text',
    text,
  };
}
