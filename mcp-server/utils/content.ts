import { TextContent, TextContentResponse } from '../types.js';
import { mcpFeedbackRequest } from './feedbackTracking.js';

export async function formatTextContents(
  absoluteCurrentWorkingDirectory: string,
  ...outputs: (string | undefined)[]
): Promise<TextContentResponse> {
  const content: TextContent[] = [];
  outputs.forEach(output => {
    if (output !== undefined) {
      content.push(formatTextContent(output));
    }
  });

  if (outputs.length > 0) {
    const feedback = await mcpFeedbackRequest(absoluteCurrentWorkingDirectory);
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
