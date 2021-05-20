const fs = require('fs');
const ModuleValidator = require('../marketplaceValidators/theme/ModuleValidator');
const { VALIDATION_RESULT } = require('../constants');

jest.mock('fs');

const makeFilesList = numFiles => {
  const files = [];
  for (let i = 0; i < numFiles; i++) {
    const base = `module-${i}.module`;
    files.push(`${base}/meta.json`);
    files.push(`${base}/fields.json`);
    files.push(`${base}/module.html`);
    files.push(`${base}/module.js`);
  }
  return files;
};

const findError = (errors, errorKey) =>
  errors.find(error => error.key === `module.${errorKey}`);

describe('validators/marketplaceValidators/theme/ModuleValidator', () => {
  it('returns error if module limit is exceeded', async () => {
    const validationErrors = ModuleValidator.validate(
      'dirName',
      makeFilesList(51)
    );
    const limitError = findError(validationErrors, 'limitExceeded');
    expect(limitError).toBeDefined();
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns no limit error if module limit is not exceeded', async () => {
    const validationErrors = ModuleValidator.validate(
      'dirName',
      makeFilesList(50)
    );
    const limitError = findError(validationErrors, 'limitExceeded');
    expect(limitError).not.toBeDefined();
  });

  it('returns error if no module meta.json file exists', async () => {
    const validationErrors = ModuleValidator.validate('dirName', [
      'module.module/module.html',
    ]);
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns error if module meta.json file has invalid json', async () => {
    fs.readFileSync.mockReturnValue('{} bad json }');

    const validationErrors = ModuleValidator.validate('dirName', [
      'module.module/meta.json',
    ]);
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns error if module meta.json file is missing a label field', async () => {
    fs.readFileSync.mockReturnValue('{ "icon": "woo" }');

    const validationErrors = ModuleValidator.validate('dirName', [
      'module.module/meta.json',
    ]);
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns error if module meta.json file is missing an icon field', async () => {
    fs.readFileSync.mockReturnValue('{ "label": "yay" }');

    const validationErrors = ModuleValidator.validate('dirName', [
      'module.module/meta.json',
    ]);
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns no error if module meta.json file exists and has all required fields', async () => {
    fs.readFileSync.mockReturnValue('{ "label": "yay", "icon": "woo" }');

    const validationErrors = ModuleValidator.validate('dirName', [
      'module.module/meta.json',
    ]);
    expect(validationErrors.length).toBe(0);
  });
});
