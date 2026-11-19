import { uiLogger } from '../logger.js';
import {
  uiDeprecatedTag,
  uiCommandRenamedDescription,
  logUiCommandRelocatedMessage,
  logUiDeprecatedMessage,
} from '../index.js';

describe('lib/ui/index deprecation helpers', () => {
  describe('uiDeprecatedTag', () => {
    it('should prepend the deprecated tag and return the string without logging', () => {
      const result = uiDeprecatedTag('A message');

      expect(result).toEqual('[DEPRECATED] A message');
      expect(uiLogger.log).not.toHaveBeenCalled();
    });
  });

  describe('logUiDeprecatedMessage', () => {
    it('should log the tagged message wrapped in blank lines', () => {
      logUiDeprecatedMessage(
        'hs old-command',
        undefined,
        'Use something else.'
      );

      const loggedMessages = vi
        .mocked(uiLogger.log)
        .mock.calls.map(call => String(call[0]));

      expect(loggedMessages).toHaveLength(3);
      expect(loggedMessages[0]).toBe('');
      expect(loggedMessages[1]).toMatch(/^\[DEPRECATED\] /);
      expect(loggedMessages[2]).toBe('');
    });
  });

  describe('uiCommandRenamedDescription', () => {
    it('should not include ANSI escape codes so yargs can wrap the describe safely', () => {
      const result = uiCommandRenamedDescription(
        'Original describe.',
        'hs project dev'
      );

      expect(result).toBe(
        '[DEPRECATED] Original describe. This command has been deprecated. Please use `hs project dev` instead.'
      );
    });
  });

  describe('logUiCommandRelocatedMessage', () => {
    it('logs a runtime notice referencing the replacement command', () => {
      logUiCommandRelocatedMessage('hs project dev');

      const loggedMessages = vi
        .mocked(uiLogger.log)
        .mock.calls.map(call => String(call[0]))
        .join('\n');

      expect(loggedMessages).toContain('hs project dev');
      expect(loggedMessages).toContain('deprecated');
    });
  });
});
