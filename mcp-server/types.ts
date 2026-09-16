export type TextContent = {
  type: 'text';
  text: string;
};

export type McpToolResponse = {
  content: TextContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};
