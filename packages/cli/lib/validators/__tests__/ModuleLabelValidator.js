const fs = require('fs');
const ModuleLabelValidator = require('../../validators/marketplaceValidators/theme/ModuleLabelValidator');
const ValidatorStore = require('../ValidatorStore');
const { VALIDATION_RESULT } = require('../../validators/constants');

jest.mock('fs');

describe('validators/marketplaceValidators/theme/ModuleLabelValidator', () => {
  beforeEach(() => {
    ValidatorStore.clear();
  });

  it('returns error if no module meta.json file exists', async () => {
    const validationErrors = ModuleLabelValidator.validate('dirName', [
      'module.module/module.html',
    ]);
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns error if module meta.json file has invalid json', async () => {
    fs.readFileSync.mockReturnValue('{} bad json }');

    const validationErrors = ModuleLabelValidator.validate('dirName', [
      'module.module/meta.json',
    ]);
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns error if module meta.json file is missing a label field', async () => {
    fs.readFileSync.mockReturnValue('{ "some": "field" }');

    const validationErrors = ModuleLabelValidator.validate('dirName', [
      'module.module/meta.json',
    ]);
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns no error if module meta.json file exists and has all required fields', async () => {
    fs.readFileSync.mockReturnValue('{ "label": "yay" }');

    const validationErrors = ModuleLabelValidator.validate('dirName', [
      'module.module/meta.json',
    ]);
    expect(validationErrors.length).toBe(0);
  });
});
