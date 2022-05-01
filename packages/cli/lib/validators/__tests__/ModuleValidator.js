const ModuleValidator = require('../marketplaceValidators/module/ModuleValidator');
const { VALIDATION_RESULT } = require('../constants');
const { MODULE_PATH } = require('./validatorTestUtils');
const marketplace = require('@hubspot/cli-lib/api/marketplace');

jest.mock('@hubspot/cli-lib/api/marketplace');

describe('validators/marketplaceValidators/module/ModuleValidator', () => {
  beforeEach(() => {
    ModuleValidator.setRelativePath(MODULE_PATH);
  });

  it('returns error if module meta.json file has invalid json', async () => {
    marketplace.fetchModuleMeta.mockReturnValue(
      Promise.resolve({ source: '{} bad json }' })
    );

    const validationErrors = await ModuleValidator.validate(MODULE_PATH);
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns error if module meta.json file is missing a label field', async () => {
    marketplace.fetchModuleMeta.mockReturnValue(
      Promise.resolve({ source: '{ "icon": "woo" }' })
    );

    const validationErrors = await ModuleValidator.validate(MODULE_PATH);
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns error if module meta.json file is missing an icon field', async () => {
    marketplace.fetchModuleMeta.mockReturnValue(
      Promise.resolve({ source: '{ "label": "yay" }' })
    );

    const validationErrors = await ModuleValidator.validate(MODULE_PATH);
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns no error if module meta.json file exists and has all required fields', async () => {
    marketplace.fetchModuleMeta.mockReturnValue(
      Promise.resolve({ source: '{ "label": "yay", "icon": "woo" }' })
    );

    const validationErrors = await ModuleValidator.validate(MODULE_PATH);
    expect(validationErrors.length).toBe(0);
  });
});
