import { uiLogger } from '../logger.js';
import {
  uiDeprecatedTag,
  uiCommandRenamedDescription,
  uiCommandRelocatedMessage,
} from '../index.js';

describe('lib/ui/index deprecation helpers', () => {
  describe('uiDeprecatedTag', () => {
    it('prepends the deprecated tag and returns the string when not logging', () => {
      const result = uiDeprecatedTag('A message', false);

      expect(result).toEqual('[DEPRECATED] A message');
      expect(uiLogger.log).not.toHaveBeenCalled();
    });

    it('logs the tagged message when logging is enabled', () => {
      const result = uiDeprecatedTag('A message');

      expect(result).toBeUndefined();
      expect(uiLogger.log).toHaveBeenCalledWith('[DEPRECATED] A message');
    });
  });

  describe('uiCommandRenamedDescription', () => {
    it('tags the describe and references the replacement command', () => {
      const result = uiCommandRenamedDescription(
        'Original describe.',
        'hs project dev'
      );

      expect(result).toContain('[DEPRECATED]');
      expect(result).toContain('Original describe.');
      expect(result).toContain('hs project dev');
    });
  });

  describe('uiCommandRelocatedMessage', () => {
    it('logs a runtime notice referencing the replacement command', () => {
      uiCommandRelocatedMessage('hs project dev');

      const loggedMessages = vi
        .mocked(uiLogger.log)
        .mock.calls.map(call => String(call[0]))
        .join('\n');

      expect(loggedMessages).toContain('hs project dev');
      expect(loggedMessages).toContain('deprecated');
    });
  });
});
