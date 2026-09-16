import { z } from 'zod';
import { McpLogger } from './logger.js';
import { getErrorMessage } from '../../lib/errorHandlers/index.js';

// Parses the stdout of a `hs ... --json` command and validates it against the
// provided schema. Returns the inferred type on success, or null if the output
// is not valid JSON or fails schema validation. Adopter tools use the returned
// object as the structuredContent of their response.
export function parseCommandJsonOutput<Schema extends z.ZodType>(
  stdout: string,
  schema: Schema,
  logger?: McpLogger,
  context?: string
): z.infer<Schema> | null {
  const loggerContext = context ?? 'parseCommandJsonOutput';

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch (e) {
    logger?.debug(loggerContext, {
      message: 'Failed to parse JSON output',
      error: getErrorMessage(e),
    });
    return null;
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    logger?.debug(loggerContext, {
      message: 'JSON output failed schema validation',
      error: z.flattenError(result.error),
    });
    return null;
  }

  return result.data;
}
