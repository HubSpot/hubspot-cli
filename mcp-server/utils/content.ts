import { TextContent, TextContentResponse } from '../types.js';

export function formatTextContents(
  ...outputs: (string | undefined)[]
): TextContentResponse {
  const content: TextContent[] = [];
  outputs.forEach(output => {
    if (output !== undefined) {
      content.push(formatTextContent(output));
    }
  });

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
