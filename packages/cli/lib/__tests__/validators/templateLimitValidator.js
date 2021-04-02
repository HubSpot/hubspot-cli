const { walk } = require('@hubspot/cli-lib');
const templateLimitValidator = require('../../validators/marketplaceValidators/templateLimitValidator');
const { VALIDATION_RESULT } = require('../../validators/constants');

jest.mock('fs');
jest.mock('@hubspot/cli-lib');

const mockWalkImplementation = (numFiles, ext = '.html') => () => {
  const files = [];
  for (let i = 0; i < numFiles; i++) {
    files.push(`file-${i}${ext}`);
  }
  return Promise.resolve(files);
};

describe('validators/templateLimitValidator', () => {
  it('returns error if template limit is exceeded', async () => {
    walk.mockImplementationOnce(mockWalkImplementation(51));
    const validationErrors = await templateLimitValidator.validate('dirName');
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns no errors if template limit is not exceeded', async () => {
    walk.mockImplementationOnce(mockWalkImplementation(49));
    const validationErrors = await templateLimitValidator.validate('dirName');
    expect(validationErrors.length).toBe(0);
  });

  it('ignores all files without the .html extension', async () => {
    walk.mockImplementationOnce(mockWalkImplementation(51, '.js'));
    const validationErrors = await templateLimitValidator.validate('dirName');
    expect(validationErrors.length).toBe(0);
  });
});
