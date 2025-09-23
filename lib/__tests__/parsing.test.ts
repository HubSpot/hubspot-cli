import { parseStringToNumber } from '../parsing.js';

describe('lib/parsing', () => {
  describe('parseStringToNumber', () => {
    it('should parse valid integer strings', () => {
      expect(parseStringToNumber('123')).toBe(123);
      expect(parseStringToNumber('0')).toBe(0);
      expect(parseStringToNumber('-456')).toBe(-456);
      expect(parseStringToNumber('999')).toBe(999);
    });

    it('should parse strings with leading zeros', () => {
      expect(parseStringToNumber('007')).toBe(7);
      expect(parseStringToNumber('0123')).toBe(123);
    });

    it('should throw error for strings with leading whitespace', () => {
      expect(() => parseStringToNumber('  42')).toThrow(
        'Unable to parse string to number'
      );
      expect(() => parseStringToNumber('\t123')).toThrow(
        'Unable to parse string to number'
      );
    });

    it('should throw error for invalid number strings', () => {
      expect(() => parseStringToNumber('abc')).toThrow(
        'Unable to parse string to number'
      );
      expect(() => parseStringToNumber('')).toThrow(
        'Unable to parse string to number'
      );
      expect(() => parseStringToNumber('NaN')).toThrow(
        'Unable to parse string to number'
      );
    });

    it('should throw error for strings with non-numeric characters', () => {
      expect(() => parseStringToNumber('123abc')).toThrow(
        'Unable to parse string to number'
      );
      expect(() => parseStringToNumber('456def')).toThrow(
        'Unable to parse string to number'
      );
      expect(() => parseStringToNumber('12.34')).toThrow(
        'Unable to parse string to number'
      );
    });

    it('should throw error for strings with mixed content', () => {
      expect(() => parseStringToNumber('123 456')).toThrow(
        'Unable to parse string to number'
      );
      expect(() => parseStringToNumber('1,234')).toThrow(
        'Unable to parse string to number'
      );
      expect(() => parseStringToNumber('1.23e4')).toThrow(
        'Unable to parse string to number'
      );
    });
  });
});
