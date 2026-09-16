import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { hasColorDisableSignal, isColorEnabled } from '../supportsColor.js';
import { stubColorEnv } from '../../testUtils.js';

const tty = { isTTY: true };
const nonTty = { isTTY: false };

describe('supportsColor', () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    stubColorEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.argv = originalArgv;
  });

  describe('hasColorDisableSignal', () => {
    it('is false with no disable signals', () => {
      expect(hasColorDisableSignal()).toBe(false);
    });

    it('is true for the public --no-color flag', () => {
      process.argv = ['node', 'hs', '--no-color'];
      expect(hasColorDisableSignal()).toBe(true);
    });

    it('is true for the legacy --noColor flag', () => {
      process.argv = ['node', 'hs', '--noColor'];
      expect(hasColorDisableSignal()).toBe(true);
    });

    it('is true when NO_COLOR is present and non-empty', () => {
      vi.stubEnv('NO_COLOR', '1');
      expect(hasColorDisableSignal()).toBe(true);
    });

    it('is false when NO_COLOR is an empty string', () => {
      vi.stubEnv('NO_COLOR', '');
      expect(hasColorDisableSignal()).toBe(false);
    });

    it('is true for COLOR=false and COLOR=0', () => {
      vi.stubEnv('COLOR', 'false');
      expect(hasColorDisableSignal()).toBe(true);
      vi.stubEnv('COLOR', '0');
      expect(hasColorDisableSignal()).toBe(true);
    });

    it('is true for TERM=dumb', () => {
      vi.stubEnv('TERM', 'dumb');
      expect(hasColorDisableSignal()).toBe(true);
    });

    it('is true for FORCE_COLOR=0 and FORCE_COLOR=false', () => {
      vi.stubEnv('FORCE_COLOR', '0');
      expect(hasColorDisableSignal()).toBe(true);
      vi.stubEnv('FORCE_COLOR', 'false');
      expect(hasColorDisableSignal()).toBe(true);
    });
  });

  describe('isColorEnabled', () => {
    it('is true for a color-capable interactive terminal', () => {
      expect(isColorEnabled(tty)).toBe(true);
    });

    it('is false for a non-TTY stream', () => {
      expect(isColorEnabled(nonTty)).toBe(false);
    });

    it('is false when --no-color is passed even on a TTY', () => {
      process.argv = ['node', 'hs', '--no-color'];
      expect(isColorEnabled(tty)).toBe(false);
    });

    it('is false when NO_COLOR is set even on a TTY', () => {
      vi.stubEnv('NO_COLOR', '1');
      expect(isColorEnabled(tty)).toBe(false);
    });

    it('is false when COLOR=false even on a TTY', () => {
      vi.stubEnv('COLOR', 'false');
      expect(isColorEnabled(tty)).toBe(false);
    });

    it('is false for TERM=dumb even on a TTY', () => {
      vi.stubEnv('TERM', 'dumb');
      expect(isColorEnabled(tty)).toBe(false);
    });

    it('lets FORCE_COLOR win over TERM=dumb', () => {
      vi.stubEnv('TERM', 'dumb');
      vi.stubEnv('FORCE_COLOR', '1');
      expect(isColorEnabled(nonTty)).toBe(true);
    });

    it('lets NO_COLOR win over FORCE_COLOR', () => {
      vi.stubEnv('FORCE_COLOR', '1');
      vi.stubEnv('NO_COLOR', '1');
      expect(isColorEnabled(tty)).toBe(false);
    });
  });
});
