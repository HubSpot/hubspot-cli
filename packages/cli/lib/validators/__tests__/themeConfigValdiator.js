const fs = require('fs');
const ThemeConfigValidator = require('../../validators/marketplaceValidators/theme/ThemeConfigValidator');
const { VALIDATION_RESULT } = require('../../validators/constants');

jest.mock('fs');

describe('validators/theme/ThemeConfigValidator', () => {
  it('returns error if no theme config exists', async () => {
    const validationErrors = ThemeConfigValidator.validate('dirName', [
      'someFile.html',
    ]);
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns error if theme config has invalid json', async () => {
    fs.readFileSync.mockReturnValue('{} bad json }');

    const validationErrors = ThemeConfigValidator.validate('dirName', [
      'theme.json',
    ]);
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns error if theme config is missing a label field', async () => {
    fs.readFileSync.mockReturnValue('{ "some": "field" }');

    const validationErrors = ThemeConfigValidator.validate('dirName', [
      'theme.json',
    ]);
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns no error if theme config exists and has all required fields', async () => {
    fs.readFileSync.mockReturnValue('{ "label": "yay" }');

    const validationErrors = ThemeConfigValidator.validate('dirName', [
      'theme.json',
    ]);
    expect(validationErrors.length).toBe(0);
  });
});
