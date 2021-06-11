const fs = require('fs-extra');
const validate = require('@hubspot/cli-lib/api/validate');

const DependencyValidator = require('../marketplaceValidators/theme/DependencyValidator');
const { VALIDATION_RESULT } = require('../constants');
const { THEME_PATH } = require('./validatorTestUtils');

jest.mock('fs-extra');
jest.mock('@hubspot/cli-lib/api/validate');

const getMockValidationResult = customPath => {
  const result = {
    renderingErrors: [
      {
        category: 'MODULE_NOT_FOUND',
        categoryErrors: { path: './relative/file-1.js' },
      },
    ],
    meta: {
      all_dependencies: {
        EXTERNAL_DEPENDENCIES: ['0'],
        OTHER_DEPS: ['./relative/file-2.js'],
      },
    },
  };
  if (customPath) {
    result.meta.all_dependencies.OTHER_DEPS.push(customPath);
  }
  return result;
};

describe('validators/marketplaceValidators/theme/DependencyValidator', () => {
  beforeEach(() => {
    DependencyValidator.setThemePath(THEME_PATH);
  });

  describe('isExternalDep', () => {
    it('returns true if dep is external to provided absolute path', () => {
      const absoluteFilePath = '/path/to/theme/file.js';
      const relativeDepPath = '../external/dep/path';
      const isExternal = DependencyValidator.isExternalDep(
        absoluteFilePath,
        relativeDepPath
      );
      expect(isExternal).toBe(true);
    });

    it('returns false if dep is not external to provided absolute path', () => {
      const absoluteFilePath = '/path/to/theme/file.js';
      const relativeDepPath = './internal/dep/path';
      const isExternal = DependencyValidator.isExternalDep(
        absoluteFilePath,
        relativeDepPath
      );
      expect(isExternal).toBe(false);
    });
  });

  describe('validate', () => {
    beforeEach(() => {
      fs.readFile.mockImplementation(() => Promise.resolve('source'));
    });

    it('returns error if any referenced path is absolute', async () => {
      validate.validateHubl.mockReturnValue(
        getMockValidationResult('/absolute/file-3.js')
      );
      const validationErrors = await DependencyValidator.validate([
        `${THEME_PATH}/template.html`,
      ]);

      expect(validationErrors.length).toBe(1);
      expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
    });

    it('returns error if any referenced path is external to the theme', async () => {
      validate.validateHubl.mockReturnValue(
        getMockValidationResult('../../external/file-3.js')
      );
      const validationErrors = await DependencyValidator.validate([
        `${THEME_PATH}/template.html`,
      ]);

      expect(validationErrors.length).toBe(1);
      expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
    });

    it('returns no errors if paths are relative and internal', async () => {
      validate.validateHubl.mockReturnValue(getMockValidationResult());
      const validationErrors = await DependencyValidator.validate([
        `${THEME_PATH}/template.html`,
      ]);

      expect(validationErrors.length).toBe(0);
    });
  });
});
