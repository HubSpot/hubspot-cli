const fs = require('fs');
const ThemeLabelValidator = require('../../validators/marketplaceValidators/theme/ThemeLabelValidator');
const { VALIDATION_RESULT } = require('../../validators/constants');

jest.mock('fs');

describe('validators/marketplaceValidators/theme/ThemeLabelValidator', () => {
  it('returns error if no theme.json file exists', async () => {
    const validationErrors = ThemeLabelValidator.validate('dirName', [
      'someFile.html',
    ]);
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns error if theme.json file has invalid json', async () => {
    fs.readFileSync.mockReturnValue('{} bad json }');

    const validationErrors = ThemeLabelValidator.validate('dirName', [
      'theme.json',
    ]);
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns error if theme.json file is missing a label field', async () => {
    fs.readFileSync.mockReturnValue('{ "some": "field" }');

    const validationErrors = ThemeLabelValidator.validate('dirName', [
      'theme.json',
    ]);
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns no error if theme.json file exists and has all required fields', async () => {
    fs.readFileSync.mockReturnValue('{ "label": "yay" }');

    const validationErrors = ThemeLabelValidator.validate('dirName', [
      'theme.json',
    ]);
    expect(validationErrors.length).toBe(0);
  });
});
