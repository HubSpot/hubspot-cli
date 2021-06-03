const { getAnnotationValue, isCodedFile } = require('../templates');

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
    it('should return false for invalid input', () => {
      expect(isCodedFile()).toBe(false);
      expect(isCodedFile(null)).toBe(false);
      expect(isCodedFile(1)).toBe(false);
    });
    it('should return false for modules', () => {
      expect(isCodedFile('folder.module/module.html')).toBe(false);
    });
    it('should return true for templates', () => {
      expect(isCodedFile('folder/template.html')).toBe(true);
    });
  });

  describe('getAnnotationValue()', () => {
    it('returns the annotation value', () => {
      const annotations = makeAnnotation({
        isAvailableForNewContent: 'true',
        templateType: 'page',
      });

      const value = getAnnotationValue(annotations, 'templateType');
      expect(value).toEqual('page');
    });
  });
});
