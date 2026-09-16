import { Mocked } from 'vitest';
import { z } from 'zod';
import { parseCommandJsonOutput } from '../json.js';
import { McpLogger } from '../logger.js';

const schema = z.object({
  buildId: z.number(),
  name: z.string().optional(),
});

describe('mcp-server/utils/json', () => {
  let mockLogger: Mocked<McpLogger>;

  beforeEach(() => {
    // @ts-expect-error Not mocking the whole thing
    mockLogger = {
      debug: vi.fn(),
    };
  });

  describe('parseCommandJsonOutput', () => {
    it('should return the validated data for valid JSON matching the schema', () => {
      const result = parseCommandJsonOutput(
        JSON.stringify({ buildId: 42, name: 'test' }),
        schema
      );

      expect(result).toEqual({ buildId: 42, name: 'test' });
    });

    it('should strip unknown keys', () => {
      const result = parseCommandJsonOutput(
        JSON.stringify({ buildId: 42, unexpected: 'value' }),
        schema
      );

      expect(result).toEqual({ buildId: 42 });
    });

    it('should return null and log when JSON is invalid', () => {
      const result = parseCommandJsonOutput(
        'not json',
        schema,
        mockLogger,
        'test-tool'
      );

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'test-tool',
        expect.objectContaining({
          message: 'Failed to parse JSON output',
        })
      );
    });

    it('should return null and log when JSON fails schema validation', () => {
      const result = parseCommandJsonOutput(
        JSON.stringify({ buildId: 'not-a-number' }),
        schema,
        mockLogger,
        'test-tool'
      );

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'test-tool',
        expect.objectContaining({
          message: 'JSON output failed schema validation',
        })
      );
    });

    it('should not throw when no logger is provided', () => {
      const result = parseCommandJsonOutput('not json', schema);

      expect(result).toBeNull();
    });
  });
});
