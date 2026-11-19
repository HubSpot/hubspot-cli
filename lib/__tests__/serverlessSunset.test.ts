import { uiLogger } from '../ui/logger.js';
import {
  isServerlessEditingDisabled,
  isServerlessFunctionPath,
  logServerlessCreationBlocked,
  logServerlessDeprecation,
  logServerlessEditingDisabled,
  logServerlessUploadBlockedHint,
} from '../serverlessSunset.js';

const BEFORE_EDITING_CUTOFF = new Date('2026-11-16T23:59:59Z');
const ON_EDITING_CUTOFF = new Date('2026-11-17T00:00:00Z');

function getLoggedMessages(method: 'log' | 'error' | 'info'): string {
  return vi
    .mocked(uiLogger[method])
    .mock.calls.map(call => String(call[0]))
    .join('\n');
}

describe('lib/serverlessSunset', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isServerlessEditingDisabled()', () => {
    it('should return false until November 17, 2026 UTC', () => {
      vi.useFakeTimers();
      vi.setSystemTime(BEFORE_EDITING_CUTOFF);

      expect(isServerlessEditingDisabled()).toBe(false);
    });

    it('should return true on November 17, 2026 UTC', () => {
      vi.useFakeTimers();
      vi.setSystemTime(ON_EDITING_CUTOFF);

      expect(isServerlessEditingDisabled()).toBe(true);
    });
  });

  describe('logServerlessEditingDisabled()', () => {
    it('should log an error banner with the Feb 1 date and the changelog link', () => {
      logServerlessEditingDisabled('hs cms function server');

      const message = getLoggedMessages('error');

      expect(message).toContain('hs cms function server');
      expect(message).toContain('disabled');
      expect(message).toContain('can no longer be created or edited');
      expect(message).toContain('February 1, 2027');
      expect(message).toContain('Developer Changelog');
    });
  });

  describe('isServerlessFunctionPath()', () => {
    it('should be true for a file inside a functions folder', () => {
      expect(isServerlessFunctionPath('src/my-test.functions/index.js')).toBe(
        true
      );
    });

    it('should be true for a functions folder itself', () => {
      expect(isServerlessFunctionPath('src/my-test.functions')).toBe(true);
    });

    it('should handle Windows separators', () => {
      expect(isServerlessFunctionPath('src\\my-test.functions\\index.js')).toBe(
        true
      );
    });

    it('should be false for other paths', () => {
      expect(isServerlessFunctionPath('src/templates/page.html')).toBe(false);
      expect(isServerlessFunctionPath('src/functions-notes/readme.md')).toBe(
        false
      );
    });
  });

  describe('logServerlessDeprecation()', () => {
    it('should log a deprecation notice with the command, the sunset dates and the changelog link', () => {
      logServerlessDeprecation('hs cms function list');

      const message = getLoggedMessages('log');

      expect(message).toContain('[DEPRECATED]');
      expect(message).toContain('hs cms function list');
      expect(message).toContain('November 17, 2026');
      expect(message).toContain('February 1, 2027');
      expect(message).toContain('Developer Changelog');
    });
  });

  describe('logServerlessCreationBlocked()', () => {
    it('should log an error banner that says functions can no longer be created', () => {
      logServerlessCreationBlocked('hs cms function create');

      const message = getLoggedMessages('error');

      expect(message).toContain('hs cms function create');
      expect(message).toContain('disabled');
      expect(message).toContain('can no longer be created');
      expect(message).toContain('Developer Projects');
    });
  });

  describe('logServerlessUploadBlockedHint()', () => {
    it('should log the creation hint before editing is disabled', () => {
      vi.useFakeTimers();
      vi.setSystemTime(BEFORE_EDITING_CUTOFF);

      logServerlessUploadBlockedHint(['src/my-test.functions/index.js']);

      expect(getLoggedMessages('info')).toContain(
        "new function folders can't be uploaded"
      );
    });

    it('should log the editing hint once editing is disabled', () => {
      vi.useFakeTimers();
      vi.setSystemTime(ON_EDITING_CUTOFF);

      logServerlessUploadBlockedHint(['src/my-test.functions/index.js']);

      expect(getLoggedMessages('info')).toContain(
        'can no longer be created or edited'
      );
    });

    it('should log a hint when a failed upload is in a functions folder', () => {
      logServerlessUploadBlockedHint([
        'src/templates/page.html',
        'src/my-test.functions/index.js',
      ]);

      expect(getLoggedMessages('info')).toContain('can no longer be created');
    });

    it('should not log a hint for other failed uploads', () => {
      logServerlessUploadBlockedHint(['src/templates/page.html']);

      expect(uiLogger.info).not.toHaveBeenCalled();
    });
  });
});
