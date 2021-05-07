const fs = require('fs');

const { isTemplate } = require('../templates');

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
  describe('isTemplate()', () => {
    it('should return falseinvalid input', () => {
      expect(isTemplate()).toBe(false);
      expect(isTemplate(null)).toBe(false);
      expect(isTemplate(1)).toBe(false);
    });
    it('should return false for modules', () => {
      expect(isTemplate('folder.module/module.html')).toBe(false);
    });
    it('should return false for partials', () => {
      // Standard partials
      fs.readFileSync.mockReturnValue(
        makeAnnotation({ isAvailableForNewContent: 'false' })
      );
      expect(isTemplate('folder.module/partial.html')).toBe(false);

      // Global partials
      fs.readFileSync.mockReturnValue(
        makeAnnotation({ templateType: 'global_partial' })
      );

      expect(isTemplate('folder.module/partial.html')).toBe(false);
    });
    it('should return false for templateType none', () => {
      fs.readFileSync.mockReturnValue(makeAnnotation({ templateType: 'none' }));

      expect(isTemplate('folder.module/template.html')).toBe(false);
    });
    it('should return true for templates', () => {
      // Without isAvailableForNewContent
      fs.readFileSync.mockReturnValue(makeAnnotation({ templateType: 'page' }));

      expect(isTemplate('folder.module/template.html')).toBe(true);

      // With isAvailableForNewContent
      fs.readFileSync.mockReturnValue(
        makeAnnotation({
          isAvailableForNewContent: 'true',
          templateType: 'page',
        })
      );

      expect(isTemplate('folder.module/template.html')).toBe(true);
    });
  });
});
