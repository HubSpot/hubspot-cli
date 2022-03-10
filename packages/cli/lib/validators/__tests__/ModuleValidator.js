const fs = require('fs');
const ModuleValidator = require('../marketplaceValidators/theme/ModuleValidator');
const { VALIDATION_RESULT } = require('../constants');
const {
  generateModulesList,
  makeFindError,
  THEME_PATH,
} = require('./validatorTestUtils');

jest.mock('fs');

const MODULE_LIMIT = 50;

const findError = makeFindError('module');

describe('validators/marketplaceValidators/theme/ModuleValidator', () => {
  beforeEach(() => {
    ModuleValidator.setAbsolutePath(THEME_PATH);
  });

  it('returns error if module limit is exceeded', async () => {
    const validationErrors = ModuleValidator.validate(
      generateModulesList(MODULE_LIMIT + 1)
    );
    const limitError = findError(validationErrors, 'limitExceeded');
    expect(limitError).toBeDefined();
    expect(limitError.result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns no limit error if module limit is not exceeded', async () => {
    const validationErrors = ModuleValidator.validate(
      generateModulesList(MODULE_LIMIT)
    );
    const limitError = findError(validationErrors, 'limitExceeded');
    expect(limitError).not.toBeDefined();
  });

  it('returns error if no module meta.json file exists', async () => {
    const validationErrors = ModuleValidator.validate([
      'module.module/module.html',
    ]);
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns error if module meta.json file has invalid json', async () => {
    fs.readFileSync.mockReturnValue('{} bad json }');

    const validationErrors = ModuleValidator.validate([
      'module.module/meta.json',
    ]);
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns error if module meta.json file is missing a label field', async () => {
    fs.readFileSync.mockReturnValue('{ "icon": "woo" }');

    const validationErrors = ModuleValidator.validate([
      'module.module/meta.json',
    ]);
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns error if module meta.json file is missing an icon field', async () => {
    fs.readFileSync.mockReturnValue('{ "label": "yay" }');

    const validationErrors = ModuleValidator.validate([
      'module.module/meta.json',
    ]);
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns no error if module meta.json file exists and has all required fields', async () => {
    fs.readFileSync.mockReturnValue('{ "label": "yay", "icon": "woo" }');

    const validationErrors = ModuleValidator.validate([
      'module.module/meta.json',
    ]);
    expect(validationErrors.length).toBe(0);
  });
});
