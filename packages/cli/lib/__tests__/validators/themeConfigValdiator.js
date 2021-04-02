const fs = require('fs');
const { read } = require('@hubspot/cli-lib');
const themeConfigValidator = require('../../validators/marketplaceValidators/themeConfigValidator');
const { VALIDATION_RESULT } = require('../../validators/constants');

jest.mock('fs');
jest.mock('@hubspot/cli-lib');

const mockReadImplementation = result => () => Promise.resolve(result);

describe('validators/themeConfigValidator', () => {
  it('returns error if no theme config exists', async () => {
    read.mockImplementationOnce(mockReadImplementation(['someFile.html']));
    const validationErrors = await themeConfigValidator.validate('dirName');
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns error if theme config has invalid json', async () => {
    fs.readFileSync.mockReturnValue('{} bad json }');
    read.mockImplementationOnce(mockReadImplementation(['theme.json']));

    const validationErrors = await themeConfigValidator.validate('dirName');
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns error if theme config is missing a label field', async () => {
    fs.readFileSync.mockReturnValue('{ "some": "field" }');
    read.mockImplementationOnce(mockReadImplementation(['theme.json']));

    const validationErrors = await themeConfigValidator.validate('dirName');
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns no error if theme config exists and has all required fields', async () => {
    fs.readFileSync.mockReturnValue('{ "label": "yay" }');
    read.mockImplementationOnce(mockReadImplementation(['theme.json']));

    const validationErrors = await themeConfigValidator.validate('dirName');
    expect(validationErrors.length).toBe(0);
  });
});
