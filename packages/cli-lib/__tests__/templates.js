const fs = require('fs');

const { isCodedFile } = require('../templates');

jest.mock('fs');

const makeAnnotation = (options = {}) => {
  let result = '<!--\n';
  Object.keys(options).forEach(key => {
    const value = options[key];
    result += `${key}: ${value}\n`;
  });
  result += '-->\n';
  return result;
};

describe('cli-lib/templates', () => {
  describe('isCodedFile()', () => {
    it('should return falseinvalid input', () => {
      expect(isCodedFile()).toBe(false);
      expect(isCodedFile(null)).toBe(false);
      expect(isCodedFile(1)).toBe(false);
    });
    it('should return false for modules', () => {
      expect(isCodedFile('folder.module/module.html')).toBe(false);
    });
    it('should return true for templates', () => {
      // Without isAvailableForNewContent
      fs.readFileSync.mockReturnValue(makeAnnotation({ templateType: 'page' }));

      expect(isCodedFile('folder.module/template.html')).toBe(true);

      // With isAvailableForNewContent
      fs.readFileSync.mockReturnValue(
        makeAnnotation({
          isAvailableForNewContent: 'true',
          templateType: 'page',
        })
      );

      expect(isCodedFile('folder.module/template.html')).toBe(true);
    });
  });
});
