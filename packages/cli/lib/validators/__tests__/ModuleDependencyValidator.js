const marketplace = require('@hubspot/cli-lib/api/marketplace');
const path = require('path');

const ModuleDependencyValidator = require('../marketplaceValidators/module/ModuleDependencyValidator');
const { VALIDATION_RESULT } = require('../constants');
const { MODULE_PATH } = require('./validatorTestUtils');

jest.mock('@hubspot/cli-lib/api/marketplace');

const getMockDependencyResult = (customPaths = []) => {
  const result = {
    dependencies: [...customPaths],
  };
  return Promise.resolve(result);
};

describe('validators/marketplaceValidators/module/ModuleDependencyValidator', () => {
  beforeEach(() => {
    ModuleDependencyValidator.setRelativePath(MODULE_PATH);
  });

  describe('isExternalDep', () => {
    beforeEach(() => {
      ModuleDependencyValidator.setRelativePath(MODULE_PATH);
    });

    it('returns true if dep is external to the provided absolute path', () => {
      const isExternal = ModuleDependencyValidator.isExternalDep(
        MODULE_PATH,
        'SomeOtherFolder/In/The/DesignManager.css'
      );
      expect(isExternal).toBe(true);
    });

    it('returns false if dep is not external to the provided absolute path', () => {
      const isExternal = ModuleDependencyValidator.isExternalDep(
        MODULE_PATH,
        `${path.parse(MODULE_PATH).dir}/Internal/Folder/style.css`
      );
      expect(isExternal).toBe(false);
    });
  });

  describe('validate', () => {
    it('returns error if any referenced path is absolute', async () => {
      marketplace.fetchModuleDependencies.mockReturnValue(
        getMockDependencyResult(['/absolute/path'])
      );
      const validationErrors = await ModuleDependencyValidator.validate(
        MODULE_PATH
      );

      expect(validationErrors.length).toBe(1);
      expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
    });

    it('returns error if any referenced path is external to the theme', async () => {
      marketplace.fetchModuleDependencies.mockReturnValue(
        getMockDependencyResult(['../../external/file-3.js'])
      );
      const validationErrors = await ModuleDependencyValidator.validate(
        MODULE_PATH
      );

      expect(validationErrors.length).toBe(1);
      expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
    });

    it('returns no errors if paths are relative and internal', async () => {
      marketplace.fetchModuleDependencies.mockReturnValue(
        getMockDependencyResult(['module/style.css', 'module/another/test.js'])
      );
      const validationErrors = await ModuleDependencyValidator.validate(
        MODULE_PATH
      );
      expect(validationErrors.length).toBe(0);
    });
  });
});
