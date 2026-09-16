import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import chalk from 'chalk';
import { getTerminalUISupport, uiCommandReference, uiLink } from '../index.js';
import { stubColorEnv } from '../../testUtils.js';

const ESC = String.fromCharCode(27);

function hasAnsi(value: string): boolean {
  return value.includes(ESC);
}

describe('ui color-aware output', () => {
  let savedChalkLevel: typeof chalk.level;
  let savedStdout: PropertyDescriptor | undefined;

  beforeEach(() => {
    stubColorEnv();
    savedChalkLevel = chalk.level;
    savedStdout = Object.getOwnPropertyDescriptor(process, 'stdout');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    chalk.level = savedChalkLevel;
    if (savedStdout) Object.defineProperty(process, 'stdout', savedStdout);
  });

  function setColorEnabled(): void {
    Object.defineProperty(process, 'stdout', {
      value: { isTTY: true },
      configurable: true,
    });
    chalk.level = 3;
  }

  function setColorDisabled(): void {
    Object.defineProperty(process, 'stdout', {
      value: { isTTY: true },
      configurable: true,
    });
    vi.stubEnv('NO_COLOR', '1');
    chalk.level = 0;
  }

  describe('when color is enabled', () => {
    it('getTerminalUISupport reports color', () => {
      setColorEnabled();
      expect(getTerminalUISupport().color).toBe(true);
    });

    it('uiCommandReference emits styled output', () => {
      setColorEnabled();
      expect(hasAnsi(uiCommandReference('hs project upload'))).toBe(true);
    });

    it('uiLink emits styled output', () => {
      setColorEnabled();
      expect(hasAnsi(uiLink('Docs', 'https://developers.hubspot.com'))).toBe(
        true
      );
    });
  });

  describe('when color is disabled (no-color contract)', () => {
    it('getTerminalUISupport reports no color', () => {
      setColorDisabled();
      expect(getTerminalUISupport().color).toBe(false);
    });

    it('uiCommandReference emits plain, unstyled text', () => {
      setColorDisabled();
      const output = uiCommandReference('hs project upload');
      expect(hasAnsi(output)).toBe(false);
      expect(output).toBe('`hs project upload`');
    });

    it('uiLink emits a plain label and url with no styling', () => {
      setColorDisabled();
      const output = uiLink('Docs', 'https://developers.hubspot.com');
      expect(hasAnsi(output)).toBe(false);
      expect(output).toBe('Docs: https://developers.hubspot.com');
    });
  });
});
