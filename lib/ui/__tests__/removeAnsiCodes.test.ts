import { describe, it, expect } from 'vitest';
import chalk from 'chalk';
import { removeAnsiCodes } from '../removeAnsiCodes.js';

describe('removeAnsiCodes', () => {
  describe('basic functionality', () => {
    it('should remove ANSI codes from colored text', () => {
      const coloredText = chalk.red('Error message');
      const cleanText = removeAnsiCodes(coloredText);
      expect(cleanText).toBe('Error message');
    });

    it('should return unchanged text when no ANSI codes are present', () => {
      const plainText = 'This is plain text';
      const result = removeAnsiCodes(plainText);
      expect(result).toBe('This is plain text');
    });

    it('should handle empty strings', () => {
      const result = removeAnsiCodes('');
      expect(result).toBe('');
    });
  });

  describe('background colors', () => {
    it('should remove background color codes', () => {
      const text = chalk.bgRed('Text with red background');
      expect(removeAnsiCodes(text)).toBe('Text with red background');
    });

    it('should remove multiple background colors', () => {
      const text = chalk.bgBlue('Blue bg') + ' ' + chalk.bgYellow('Yellow bg');
      expect(removeAnsiCodes(text)).toBe('Blue bg Yellow bg');
    });
  });

  describe('text formatting', () => {
    it('should remove bold formatting', () => {
      const text = chalk.bold('Bold text');
      expect(removeAnsiCodes(text)).toBe('Bold text');
    });
  });

  describe('combined styles', () => {
    it('should remove multiple formatting styles', () => {
      const text = chalk.bold.red('Bold red text');
      expect(removeAnsiCodes(text)).toBe('Bold red text');
    });

    it('should remove complex combinations', () => {
      const text = chalk.bold.underline.red.bgYellow('Complex styling');
      expect(removeAnsiCodes(text)).toBe('Complex styling');
    });

    it('should handle chained styles', () => {
      const text =
        chalk.red('Red') + chalk.green(' Green') + chalk.blue(' Blue');
      expect(removeAnsiCodes(text)).toBe('Red Green Blue');
    });
  });

  describe('multiline text', () => {
    it('should remove ANSI codes from multiline text', () => {
      const text =
        chalk.red('Line 1\n') + chalk.green('Line 2\n') + chalk.blue('Line 3');
      const expected = 'Line 1\nLine 2\nLine 3';
      expect(removeAnsiCodes(text)).toBe(expected);
    });

    it('should handle mixed formatted and plain lines', () => {
      const text =
        chalk.bold('Formatted line\n') +
        'Plain line\n' +
        chalk.italic('Another formatted line');
      const expected = 'Formatted line\nPlain line\nAnother formatted line';
      expect(removeAnsiCodes(text)).toBe(expected);
    });
  });

  describe('edge cases', () => {
    it('should handle text with only ANSI codes (no visible text)', () => {
      const text = chalk.red('');
      expect(removeAnsiCodes(text)).toBe('');
    });

    it('should handle multiple consecutive ANSI codes', () => {
      // Create text with multiple style applications
      const text = chalk.red(chalk.bold(chalk.underline('Heavily styled')));
      expect(removeAnsiCodes(text)).toBe('Heavily styled');
    });

    it('should handle mixed content with spaces and special characters', () => {
      const text =
        chalk.green('Success:') + ' ' + chalk.red('Error!') + ' @#$%^&*()';
      expect(removeAnsiCodes(text)).toBe('Success: Error! @#$%^&*()');
    });

    it('should handle text with tabs and newlines', () => {
      const text =
        chalk.yellow('\tTabbed text\n') + chalk.cyan('New line text');
      expect(removeAnsiCodes(text)).toBe('\tTabbed text\nNew line text');
    });
  });
});
